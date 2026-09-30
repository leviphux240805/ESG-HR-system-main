import type { ApprovalItem, ChildDetail, ChildFields, ChildItem, ChildMark, ClassItem, RollCall, TodaySummary } from "@/api/contracts";
import { db, type ChildRec, type ClassRec } from "../db";
import { addDays, isSchoolDay, lastSchoolDay } from "../dates";
import { nutritionStatus } from "../growth";
import { ageMonths } from "../dates";
import { type Ctx, MockError, matches, newId, notFound, on, paginate, requireBgh } from "../router";
import {
  approveLeave,
  approvedLeaveOn,
  classOfTeacher,
  leaveLabel,
  notify,
  positionLabel,
  rejectLeave,
  schoolStaff,
  staffById,
  staffName,
  today,
} from "./common";
import { invoiceBalance } from "./finance";

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Lớp người dùng được xem: BGH thấy mọi lớp của cơ sở; giáo viên chỉ lớp mình. */
export function visibleClasses(ctx: Ctx): ClassRec[] {
  return db().classes.filter((c) => c.schoolId === ctx.schoolId && (ctx.user.isBgh || c.teacherIds.includes(ctx.user.staff.id)));
}

function requireClass(ctx: Ctx, classId: string): ClassRec {
  const cls = visibleClasses(ctx).find((c) => c.id === classId);
  if (!cls) notFound("lớp");
  return cls;
}

function requireChild(ctx: Ctx, id: string): ChildRec {
  const child = db().children.find((c) => c.id === id);
  if (!child || !visibleClasses(ctx).some((c) => c.id === child.classId)) notFound("hồ sơ trẻ");
  return child;
}

function childrenOf(classId: string, date = today()) {
  return db().children.filter((c) => c.classId === classId && c.enrolledOn <= date);
}

function substitutionFor(classId: string, absentStaffId: string, date: string) {
  return db().substitutions.find((s) => s.classId === classId && s.absentStaffId === absentStaffId && s.date === date);
}

// ---- Hôm nay ----

on("GET", "/today", (ctx) => {
  requireBgh(ctx);
  const date = today();
  const schoolDay = lastSchoolDay(date);
  const marks = db().childAttendance[schoolDay] ?? {};
  const classes = db().classes.filter((c) => c.schoolId === ctx.schoolId);
  const classSummaries = classes.map((cls) => {
    const kids = childrenOf(cls.id, schoolDay);
    const count = (m: ChildMark) => kids.filter((k) => marks[k.id] === m).length;
    const teachers = cls.teacherIds.map((id) => {
      const onLeave = !!approvedLeaveOn(id, date);
      const sub = onLeave ? substitutionFor(cls.id, id, date) : undefined;
      return { id, fullName: staffName(id), onLeave, substituteName: sub ? staffName(sub.staffId) : undefined };
    });
    return {
      id: cls.id,
      name: cls.name,
      ageGroup: cls.ageGroup,
      enrolled: kids.length,
      present: count("P"),
      excused: count("E"),
      absent: count("A"),
      taken: kids.some((k) => marks[k.id]),
      teachers,
      shortStaffed: teachers.some((t) => t.onLeave && !t.substituteName),
    };
  });
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const staff = schoolStaff(ctx.schoolId);
  const onLeave = staff
    .map((s) => ({ s, leave: approvedLeaveOn(s.id, date) }))
    .filter((x) => x.leave)
    .map(({ s, leave }) => {
      const cls = classOfTeacher(s.id);
      const sub = cls ? substitutionFor(cls.id, s.id, date) : undefined;
      return {
        staffId: s.id,
        fullName: s.fullName,
        position: positionLabel(s),
        leaveCode: leaveLabel(leave!.leaveCode, leave!.halfDay),
        classId: cls?.id,
        className: cls?.name,
        substituteName: sub ? staffName(sub.staffId) : undefined,
      };
    });
  const busy = new Set([...onLeave.map((l) => l.staffId), ...db().substitutions.filter((s) => s.date === date).map((s) => s.staffId)]);
  const tasks = db().tasks.filter((t) => t.schoolId === ctx.schoolId && t.status !== "DONE");
  const summary: TodaySummary = {
    date,
    schoolDay,
    isSchoolDay: isSchoolDay(date),
    classes: classSummaries,
    absentChildren: db()
      .children.filter((c) => c.schoolId === ctx.schoolId && marks[c.id] && marks[c.id] !== "P")
      .map((c) => ({ id: c.id, fullName: c.fullName, className: className.get(c.classId) ?? "", mark: marks[c.id] as "E" | "A" })),
    staffOnLeave: onLeave,
    availableStaff: staff
      .filter((s) => !busy.has(s.id) && !["COOK", "SECURITY"].includes(s.position))
      .map((s) => ({ id: s.id, fullName: s.fullName, position: classOfTeacher(s.id) ? `${positionLabel(s)} · ${classOfTeacher(s.id)!.name}` : positionLabel(s) })),
    pending: {
      leaves: db().leaves.filter((l) => l.schoolId === ctx.schoolId && l.status === "PENDING" && l.staffId !== ctx.user.staff.id).length,
      tasks: tasks.filter((t) => t.status === "WAITING_APPROVAL").length,
    },
    tasksDueToday: tasks.filter((t) => t.dueDate === date).length,
    tasksOverdue: tasks.filter((t) => t.dueDate < date).length,
  };
  return summary;
});

on("POST", "/substitutions", (ctx) => {
  requireBgh(ctx);
  const { classId, absentStaffId, staffId } = ctx.body ?? {};
  const cls = requireClass(ctx, classId);
  const substitute = staffById(staffId);
  if (!substitute || substitute.schoolId !== ctx.schoolId) throw new MockError(400, "Người thay không thuộc cơ sở này.");
  const date = today();
  db().substitutions = db().substitutions.filter((s) => !(s.classId === classId && s.absentStaffId === absentStaffId && s.date === date));
  db().substitutions.push({ id: newId(), schoolId: ctx.schoolId, date, classId, absentStaffId, staffId });
  notify(staffId, "Bạn được phân công dạy thay", `Lớp ${cls.name} hôm nay (thay ${staffName(absentStaffId)}).`, "/diem-danh");
});

// ---- Hộp duyệt ----

function approvalItems(ctx: Ctx): ApprovalItem[] {
  const leaves: ApprovalItem[] = db()
    .leaves.filter((l) => l.schoolId === ctx.schoolId && l.status === "PENDING" && l.staffId !== ctx.user.staff.id)
    .map((l) => {
      const staff = staffById(l.staffId);
      const cls = classOfTeacher(l.staffId);
      const details = [
        { label: "Thời gian", value: l.fromDate === l.toDate ? fmt(l.fromDate) : `${fmt(l.fromDate)} – ${fmt(l.toDate)}` },
        { label: "Số ngày", value: String(l.days).replace(".", ",") },
        { label: "Lý do", value: l.reason },
      ];
      if (cls) details.push({ label: "Lớp phụ trách", value: cls.name });
      return { id: l.id, type: "LEAVE", title: leaveLabel(l.leaveCode, l.halfDay), requester: staff?.fullName ?? "—", requesterPosition: positionLabel(staff), createdAt: l.createdAt, details };
    });
  const tasks: ApprovalItem[] = db()
    .tasks.filter((t) => t.schoolId === ctx.schoolId && t.status === "WAITING_APPROVAL")
    .map((t) => {
      const done = t.checklist.filter((c) => c.done).length;
      const details = [{ label: "Hạn", value: fmt(t.dueDate) }];
      if (t.checklist.length) details.push({ label: "Checklist", value: `${done}/${t.checklist.length}` });
      const last = t.comments[t.comments.length - 1];
      if (last) details.push({ label: "Bình luận", value: `${last.author}: ${last.body}` });
      return { id: t.id, type: "TASK", title: t.title, requester: t.assigneeIds.map(staffName).join(", "), createdAt: last?.at ?? t.createdAt, details };
    });
  return [...leaves, ...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

on("GET", "/approvals", (ctx) => {
  requireBgh(ctx);
  return approvalItems(ctx);
});

function decide(ctx: Ctx, approve: boolean) {
  requireBgh(ctx);
  const { type, id } = ctx.params;
  const note: string | undefined = ctx.body?.note;
  if (type === "LEAVE") {
    const leave = db().leaves.find((l) => l.id === id && l.schoolId === ctx.schoolId);
    if (!leave) notFound("đơn nghỉ");
    if (approve) approveLeave(leave, ctx, note);
    else rejectLeave(leave, ctx, note ?? "");
    return;
  }
  const task = db().tasks.find((t) => t.id === id && t.schoolId === ctx.schoolId);
  if (!task) notFound("công việc");
  if (task.status !== "WAITING_APPROVAL") throw new MockError(409, "Việc không còn ở trạng thái chờ duyệt.");
  if (!approve && !note?.trim()) throw new MockError(400, "Vui lòng nhập lý do trả lại.");
  task.status = approve ? "DONE" : "IN_PROGRESS";
  task.comments.push({
    id: newId(),
    author: ctx.user.staff.fullName,
    body: approve ? `Đã duyệt hoàn thành.${note ? ` ${note}` : ""}` : `Trả lại: ${note!.trim()}`,
    at: new Date().toISOString(),
  });
  for (const id of task.assigneeIds) notify(id, approve ? "Việc đã được duyệt" : "Việc bị trả lại", task.title, "/cong-viec");
}

on("POST", "/approvals/{type}/{id}/approve", (ctx) => decide(ctx, true));
on("POST", "/approvals/{type}/{id}/reject", (ctx) => decide(ctx, false));

// ---- Lớp, trẻ ----

function attendanceRate(childId: string, days = 30): number {
  const from = addDays(today(), -days);
  let total = 0;
  let present = 0;
  for (const [date, marks] of Object.entries(db().childAttendance)) {
    if (date < from || !marks[childId]) continue;
    total += 1;
    if (marks[childId] === "P") present += 1;
  }
  return total ? Math.round((present / total) * 100) : 100;
}

on("GET", "/classes", (ctx) => {
  const marks = db().childAttendance[today()];
  return visibleClasses(ctx).map<ClassItem>((cls) => {
    const kids = childrenOf(cls.id);
    return {
      id: cls.id,
      name: cls.name,
      ageGroup: cls.ageGroup,
      room: cls.room,
      capacity: cls.capacity,
      size: kids.length,
      boys: kids.filter((k) => k.gender === "MALE").length,
      girls: kids.filter((k) => k.gender === "FEMALE").length,
      teachers: cls.teacherIds.map((id) => ({ id, fullName: staffName(id) })),
      presentToday: marks && kids.some((k) => marks[k.id]) ? kids.filter((k) => marks[k.id] === "P").length : null,
    };
  });
});

function toItem(child: ChildRec): ChildItem {
  return {
    id: child.id,
    code: child.code,
    fullName: child.fullName,
    nickname: child.nickname,
    gender: child.gender,
    dob: child.dob,
    classId: child.classId,
    className: db().classes.find((c) => c.id === child.classId)?.name ?? "",
    guardianName: child.guardianName,
    guardianPhone: child.guardianPhone,
    allergies: child.allergies,
    attendanceRate: attendanceRate(child.id),
  };
}

on("GET", "/children", (ctx) => {
  const classIds = new Set(visibleClasses(ctx).map((c) => c.id));
  const classId = ctx.query.get("classId");
  const gender = ctx.query.get("gender");
  const q = ctx.query.get("q");
  const list = db()
    .children.filter((c) => classIds.has(c.classId) && (!classId || c.classId === classId) && (!gender || c.gender === gender))
    .filter((c) => matches(q, c.fullName, c.nickname, c.code, c.guardianName, c.guardianPhone))
    .map(toItem);
  return paginate(list, ctx.query, {
    fullName: (c) => c.fullName.split(" ").pop() + c.fullName,
    dob: (c) => c.dob,
    className: (c) => c.className,
    attendanceRate: (c) => c.attendanceRate,
  });
});

on("GET", "/children/{id}", (ctx) => {
  const child = requireChild(ctx, ctx.params.id);
  const recent: { date: string; mark: ChildMark }[] = [];
  const totals = { present: 0, excused: 0, absent: 0 };
  const from = addDays(today(), -30);
  for (const [date, marks] of Object.entries(db().childAttendance).sort(([a], [b]) => b.localeCompare(a))) {
    const mark = marks[child.id];
    if (!mark || date < from) continue;
    if (recent.length < 20) recent.push({ date, mark });
    totals[mark === "P" ? "present" : mark === "E" ? "excused" : "absent"] += 1;
  }
  const latest = db().growth.filter((g) => g.childId === child.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const detail: ChildDetail = {
    ...child,
    className: db().classes.find((c) => c.id === child.classId)?.name ?? "",
    schoolName: db().schools.find((s) => s.id === child.schoolId)?.name ?? "",
    attendance: { ...totals, recent },
    latestMeasurement: latest && { ...latest, status: nutritionStatus(child.gender, ageMonths(child.dob, latest.date), latest.heightCm, latest.weightKg) },
    balance: invoiceBalance(child.id),
  };
  return detail;
});

function validateChild(ctx: Ctx, body: ChildFields) {
  if (!body?.fullName?.trim()) throw new MockError(400, "Vui lòng nhập họ tên trẻ.");
  requireClass(ctx, body.classId);
}

on("PUT", "/children/{id}", (ctx) => {
  requireBgh(ctx);
  const child = requireChild(ctx, ctx.params.id);
  validateChild(ctx, ctx.body);
  Object.assign(child, ctx.body as ChildFields);
  return toItem(child);
});

on("POST", "/children", (ctx) => {
  requireBgh(ctx);
  validateChild(ctx, ctx.body);
  const n = db().children.length + 1;
  const child: ChildRec = {
    ...(ctx.body as ChildFields),
    id: `c${String(n).padStart(3, "0")}-${newId().slice(0, 4)}`,
    code: `HS${today().slice(2, 4)}${String(n).padStart(4, "0")}`,
    schoolId: ctx.schoolId,
    enrolledOn: today(),
  };
  db().children.push(child);
  return toItem(child);
});

// ---- Điểm danh trẻ ----

on("GET", "/roll-call", (ctx) => {
  const cls = requireClass(ctx, ctx.query.get("classId") ?? "");
  const date = ctx.query.get("date") ?? today();
  const marks = db().childAttendance[date] ?? {};
  const result: RollCall = {
    classId: cls.id,
    className: cls.name,
    date,
    isSchoolDay: isSchoolDay(date),
    rows: childrenOf(cls.id, date).map((c) => ({
      childId: c.id,
      fullName: c.fullName,
      nickname: c.nickname,
      gender: c.gender,
      mark: marks[c.id] ?? null,
      note: db().childNotes[`${c.id}|${date}`],
      allergies: c.allergies,
    })),
  };
  return result;
});

on("PUT", "/roll-call", (ctx) => {
  const { classId, date, rows } = ctx.body ?? {};
  const cls = requireClass(ctx, classId);
  if (!isSchoolDay(date)) throw new MockError(400, "Ngày này không phải ngày học.");
  if (date > today()) throw new MockError(400, "Không điểm danh trước cho ngày chưa tới.");
  const marks = (db().childAttendance[date] ??= {});
  const ids = new Set(childrenOf(cls.id, date).map((c) => c.id));
  for (const row of rows as { childId: string; mark: ChildMark | null; note?: string }[]) {
    if (!ids.has(row.childId)) continue;
    if (row.mark) marks[row.childId] = row.mark;
    else delete marks[row.childId];
    const key = `${row.childId}|${date}`;
    if (row.note?.trim()) db().childNotes[key] = row.note.trim();
    else delete db().childNotes[key];
  }
});
