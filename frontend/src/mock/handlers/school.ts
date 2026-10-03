import type { components } from "@/api/schema";
import { db, type ChildMark, type ChildRec, type ClassRec } from "../db";
import { holidayName, isSchoolDay, monthDays, weekday } from "../dates";
import { type Ctx, MockError, matches, newId, notFound, on, paginate, requireBgh } from "../router";
import { approveLeave, approvedLeaveOn, notify, rejectLeave, schoolStaff, staffById, staffName, today } from "./common";
import { sheetFile } from "../excel";

type S = components["schemas"];
type Status = S["MarkRow"]["status"];

// Bản demo của TodayService, ApprovalService, ClassroomService, ChildService, ChildAttendanceService.

const STATUS: Record<ChildMark, Status> = { P: "PRESENT", E: "EXCUSED", A: "ABSENT" };
const MARK: Record<Status, ChildMark> = { PRESENT: "P", EXCUSED: "E", ABSENT: "A" };

/** Lớp người dùng được xem: BGH thấy mọi lớp của trường đang chọn; giáo viên chỉ lớp mình. */
export function visibleClasses(ctx: Ctx): ClassRec[] {
  return db().classes.filter((c) => ctx.schoolIds.includes(c.schoolId) && (ctx.user.isBgh || c.teacherIds.includes(ctx.user.staff.id)));
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

const className = (id: string) => db().classes.find((c) => c.id === id)?.name ?? "";
const schoolName = (id: string) => db().schools.find((s) => s.id === id)?.name ?? "";

function substitutionFor(classId: string, absentStaffId: string, date: string) {
  return db().substitutions.find((s) => s.classId === classId && s.absentStaffId === absentStaffId && s.date === date);
}

// ---- Hôm nay ----

on("GET", "/today", (ctx) => {
  requireBgh(ctx);
  const date = today();
  const marks = db().childAttendance[date] ?? {};
  const classes = db().classes.filter((c) => ctx.schoolIds.includes(c.schoolId));
  const ageGroup = (code: string) => db().ageGroups.find((g) => g.code === code)?.name ?? "";
  const staff = ctx.schoolIds.flatMap(schoolStaff);
  const onLeave = new Map(staff.flatMap((s) => (approvedLeaveOn(s.id, date) ? [[s.id, approvedLeaveOn(s.id, date)!] as const] : [])));
  const substitute = (classId: string, staffId: string) => {
    const sub = onLeave.has(staffId) ? substitutionFor(classId, staffId, date) : undefined;
    return { substituteStaffId: sub?.staffId, substituteName: sub ? staffName(sub.staffId) : undefined };
  };
  const tasks = db().tasks.filter((t) => ctx.schoolIds.includes(t.schoolId) && t.status !== "DONE" && t.status !== "CANCELLED");
  const result: S["TodaySummary"] = {
    date,
    schoolDay: isSchoolDay(date),
    classes: classes.map((cls) => {
      const kids = childrenOf(cls.id);
      const count = (m: ChildMark) => kids.filter((k) => marks[k.id] === m).length;
      const teachers = cls.teacherIds.map((id) => ({ staffId: id, fullName: staffName(id), onLeave: onLeave.has(id), ...substitute(cls.id, id) }));
      return {
        id: cls.id,
        schoolId: cls.schoolId,
        schoolName: schoolName(cls.schoolId),
        name: cls.name,
        ageGroupName: ageGroup(cls.ageGroup),
        size: kids.length,
        present: count("P"),
        excused: count("E"),
        absent: count("A"),
        taken: kids.some((k) => marks[k.id]),
        teachers,
        shortStaffed: teachers.some((t) => t.onLeave && !t.substituteStaffId),
      };
    }),
    absentChildren: db()
      .children.filter((c) => ctx.schoolIds.includes(c.schoolId) && marks[c.id] && marks[c.id] !== "P")
      .map((c) => ({ childId: c.id, fullName: c.fullName, classId: c.classId, className: className(c.classId), status: STATUS[marks[c.id]] })),
    staffOnLeave: [...onLeave].map(([id, leave]) => {
      const s = staffById(id)!;
      return {
        staffId: id,
        fullName: s.fullName,
        position: s.position,
        schoolId: s.schoolId,
        attendanceCode: `${leave.halfDay ? "1/2" : ""}${leave.leaveCode}`,
        classes: classes.filter((c) => c.teacherIds.includes(id)).map((c) => ({ classId: c.id, className: c.name, ...substitute(c.id, id) })),
      };
    }),
    availableStaff: staff.filter((s) => !onLeave.has(s.id)).map((s) => ({ staffId: s.id, fullName: s.fullName, position: s.position, schoolId: s.schoolId })),
    pendingLeaves: db().leaves.filter((l) => ctx.schoolIds.includes(l.schoolId) && l.status === "PENDING" && l.staffId !== ctx.user.staff.id).length,
    pendingTasks: tasks.filter((t) => t.status === "WAITING_APPROVAL").length,
    tasksDueToday: tasks.filter((t) => t.dueDate === date).length,
    tasksOverdue: tasks.filter((t) => t.dueDate < date).length,
    canAssignSubstitute: true,
  };
  return result;
});

on("POST", "/substitutions", (ctx) => {
  requireBgh(ctx);
  const { classId, absentStaffId, staffId } = (ctx.body ?? {}) as S["SubstitutionRequest"];
  const cls = requireClass(ctx, classId);
  if (!cls.teacherIds.includes(absentStaffId)) throw new MockError(400, "Giáo viên nghỉ không phụ trách lớp này.");
  const substitute = staffById(staffId);
  if (!substitute || substitute.schoolId !== cls.schoolId || staffId === absentStaffId) throw new MockError(400, "Chọn người dạy thay đang làm việc ở cùng trường.");
  const date = today();
  db().substitutions = db().substitutions.filter((s) => !(s.classId === classId && s.absentStaffId === absentStaffId && s.date === date));
  db().substitutions.push({ id: newId(), schoolId: cls.schoolId, date, classId, absentStaffId, staffId });
  notify(staffId, "Bạn được phân công dạy thay", `Lớp ${cls.name} hôm nay (thay ${staffName(absentStaffId)}).`, "/diem-danh");
});

// ---- Hộp duyệt ----

on("GET", "/approvals", (ctx): S["ApprovalItem"][] => {
  if (!ctx.user.isBgh) return [];
  const leaves: S["ApprovalItem"][] = db()
    .leaves.filter((l) => ctx.schoolIds.includes(l.schoolId) && l.status === "PENDING" && l.staffId !== ctx.user.staff.id)
    .map((l) => ({
      id: l.id,
      type: "LEAVE",
      schoolId: l.schoolId,
      schoolName: schoolName(l.schoolId),
      requester: staffName(l.staffId),
      createdAt: l.createdAt,
      leave: { leaveCode: l.leaveCode, attendanceCode: `${l.halfDay ? "1/2" : ""}${l.leaveCode}`, fromDate: l.fromDate, toDate: l.toDate, days: l.days, reason: l.reason },
    }));
  const tasks: S["ApprovalItem"][] = db()
    .tasks.filter((t) => ctx.schoolIds.includes(t.schoolId) && t.status === "WAITING_APPROVAL")
    .map((t) => ({
      id: t.id,
      type: "TASK",
      schoolId: t.schoolId,
      schoolName: schoolName(t.schoolId),
      requester: t.assigneeIds.map(staffName).join(", "),
      createdAt: t.createdAt,
      task: { title: t.title, dueAt: `${t.dueDate}T16:59:00Z`, checklistDone: t.checklist.filter((c) => c.done).length, checklistTotal: t.checklist.length },
    }));
  return [...leaves, ...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

function decide(ctx: Ctx, approve: boolean) {
  requireBgh(ctx);
  const { type, id } = ctx.params;
  const note: string | undefined = ctx.body?.note;
  if (!approve && !note?.trim()) throw new MockError(400, "Vui lòng nhập lý do từ chối.");
  if (type === "LEAVE") {
    const leave = db().leaves.find((l) => l.id === id && ctx.schoolIds.includes(l.schoolId));
    if (!leave) notFound("đơn nghỉ");
    if (approve) approveLeave(leave, ctx, note);
    else rejectLeave(leave, ctx, note!);
    return;
  }
  const task = db().tasks.find((t) => t.id === id && ctx.schoolIds.includes(t.schoolId) && t.status === "WAITING_APPROVAL");
  if (!task) notFound("việc chờ duyệt");
  task.status = approve ? "DONE" : "IN_PROGRESS";
  if (note?.trim()) task.comments.push({ id: newId(), author: ctx.user.staff.fullName, body: approve ? note.trim() : `Chưa duyệt: ${note.trim()}`, at: new Date().toISOString() });
  for (const staffId of task.assigneeIds) notify(staffId, approve ? "Việc đã được duyệt" : "Việc bị trả lại", task.title, "/cong-viec");
}

on("POST", "/approvals/{type}/{id}/approve", (ctx) => decide(ctx, true));
on("POST", "/approvals/{type}/{id}/reject", (ctx) => decide(ctx, false));

// ---- Lớp ----

on("GET", "/classes", (ctx): S["ClassItem"][] => {
  const marks = db().childAttendance[today()];
  const year = db().schoolYears.find((y) => y.current);
  return visibleClasses(ctx).map((cls) => {
    const kids = childrenOf(cls.id);
    const group = db().ageGroups.find((g) => g.code === cls.ageGroup)!;
    const boys = kids.filter((k) => k.gender === "MALE").length;
    return {
      id: cls.id,
      schoolId: cls.schoolId,
      schoolYearId: year?.id ?? "",
      name: cls.name,
      room: cls.room,
      ageGroupId: group.id,
      ageGroupCode: group.code,
      ageGroupName: group.name,
      capacity: cls.capacity,
      maxClassSize: group.maxClassSize,
      size: kids.length,
      boys,
      girls: kids.length - boys,
      teachers: cls.teacherIds.map((staffId, i) => ({
        id: `${cls.id}-${staffId}`,
        staffId,
        fullName: staffName(staffId),
        role: i === 0 ? "MAIN" : "ASSISTANT",
        fromDate: year?.startDate ?? today(),
      })),
      presentToday: marks && kids.some((k) => marks[k.id]) ? kids.filter((k) => marks[k.id] === "P").length : undefined,
      archived: false,
      canManage: ctx.user.isBgh,
    };
  });
});

// ---- Trẻ ----

function toItem(child: ChildRec): S["ChildItem"] {
  return {
    id: child.id,
    schoolId: child.schoolId,
    code: child.code,
    fullName: child.fullName,
    nickname: child.nickname || undefined,
    gender: child.gender,
    dob: child.dob,
    classId: child.classId,
    className: className(child.classId),
    guardianName: child.guardianName,
    guardianPhone: child.guardianPhone || undefined,
    allergyNote: child.allergies || undefined,
    status: "STUDYING",
  };
}

function toDetail(ctx: Ctx, child: ChildRec): S["ChildDetail"] {
  const guardianId = `${child.id}-g`;
  return {
    item: toItem(child),
    enrolledAt: child.enrolledOn,
    addressDetail: child.address || undefined,
    healthNote: child.healthNote,
    guardians: [
      { id: guardianId, guardianId, fullName: child.guardianName, relationship: child.guardianRelation, phone: child.guardianPhone || undefined, primary: true, canPickUp: true },
    ],
    enrollments: [{ id: `${child.id}-e`, classId: child.classId, className: className(child.classId), fromDate: child.enrolledOn }],
    documents: [],
    canEdit: ctx.user.isBgh,
  };
}

on("GET", "/children", (ctx) => {
  const classIds = new Set(visibleClasses(ctx).map((c) => c.id));
  const classId = ctx.query.get("classId");
  const gender = ctx.query.get("gender");
  const status = ctx.query.get("status");
  const list = db()
    .children.filter((c) => classIds.has(c.classId) && (!classId || c.classId === classId) && (!gender || c.gender === gender) && (!status || status === "STUDYING"))
    .filter((c) => matches(ctx.query.get("q"), c.fullName, c.nickname, c.code))
    .map(toItem);
  return paginate(list, ctx.query, {
    fullName: (c) => c.fullName.split(" ").pop() + c.fullName,
    dob: (c) => c.dob,
    childCode: (c) => c.code,
  });
});

on("GET", "/children/{id}", (ctx) => toDetail(ctx, requireChild(ctx, ctx.params.id)));

function profileFields(body: S["ChildProfileRequest"]) {
  if (!body?.fullName?.trim()) throw new MockError(400, "Vui lòng nhập họ tên trẻ.");
  return {
    fullName: body.fullName.trim(),
    nickname: body.nickname ?? "",
    gender: body.gender,
    dob: body.dob,
    address: body.addressDetail ?? "",
    allergies: body.allergyNote,
    healthNote: body.healthNote,
  };
}

on("PUT", "/children/{id}", (ctx) => {
  requireBgh(ctx);
  const child = requireChild(ctx, ctx.params.id);
  Object.assign(child, profileFields(ctx.body));
  return toDetail(ctx, child);
});

on("POST", "/children", (ctx) => {
  requireBgh(ctx);
  const body = ctx.body as S["CreateChildRequest"];
  if (!body.classId) throw new MockError(400, "Bản demo cần chọn lớp cho trẻ.");
  const cls = requireClass(ctx, body.classId);
  const guardian = body.guardians?.[0];
  const n = db().children.length + 1;
  const child: ChildRec = {
    ...profileFields(body.profile),
    classId: cls.id,
    guardianName: guardian?.fullName ?? "",
    guardianRelation: guardian?.relationship ?? "",
    guardianPhone: guardian?.phone ?? "",
    id: `c${String(n).padStart(3, "0")}-${newId().slice(0, 4)}`,
    code: `HS${today().slice(2, 4)}${String(n).padStart(4, "0")}`,
    schoolId: cls.schoolId,
    enrolledOn: body.enrolledAt,
  };
  db().children.push(child);
  return toDetail(ctx, child);
});

// ---- Điểm danh trẻ ----

function rollCall(ctx: Ctx, cls: ClassRec, date: string): S["RollCall"] {
  const marks = db().childAttendance[date] ?? {};
  const rows: S["RollCallRow"][] = childrenOf(cls.id, date).map((c) => ({
    childId: c.id,
    code: c.code,
    fullName: c.fullName,
    nickname: c.nickname || undefined,
    gender: c.gender,
    status: marks[c.id] ? STATUS[marks[c.id]] : undefined,
    note: db().childNotes[`${c.id}|${date}`],
    allergyNote: c.allergies || undefined,
    pickUps: [{ guardianId: `${c.id}-g`, fullName: c.guardianName, relationship: c.guardianRelation }],
  }));
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  return {
    classId: cls.id,
    className: cls.name,
    date,
    schoolDay: isSchoolDay(date),
    mealCutoffTime: "09:00:00",
    locked: false,
    canEdit: date <= today(),
    canUnlock: false,
    rows,
    summary: { total: rows.length, present: count("PRESENT"), excused: count("EXCUSED"), absent: count("ABSENT"), unmarked: rows.filter((r) => !r.status).length },
  };
}

on("GET", "/classes/{id}/attendance", (ctx) => rollCall(ctx, requireClass(ctx, ctx.params.id), ctx.query.get("date") ?? today()));

on("PUT", "/classes/{id}/attendance", (ctx) => {
  const cls = requireClass(ctx, ctx.params.id);
  const { date, rows } = ctx.body as S["MarkRequest"];
  if (!isSchoolDay(date)) throw new MockError(400, "Ngày này không phải ngày học.");
  if (date > today()) throw new MockError(400, "Không điểm danh trước cho ngày chưa tới.");
  const marks = (db().childAttendance[date] ??= {});
  const ids = new Set(childrenOf(cls.id, date).map((c) => c.id));
  for (const row of rows) {
    if (!ids.has(row.childId)) continue;
    marks[row.childId] = MARK[row.status];
    const key = `${row.childId}|${date}`;
    if (row.note?.trim()) db().childNotes[key] = row.note.trim();
    else delete db().childNotes[key];
  }
  return rollCall(ctx, cls, date);
});

// ---- Sổ điểm danh tháng ----

const CODE: Record<ChildMark, string> = { P: "C", E: "P", A: "K" };

function rollBook(ctx: Ctx): S["RollBook"] {
  const cls = requireClass(ctx, ctx.params.id);
  const month = ctx.query.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new MockError(400, "Tháng không hợp lệ (định dạng yyyy-MM).");
  const now = today();
  const dates = monthDays(month);
  const kids = db().children.filter((c) => c.classId === cls.id && c.enrolledOn <= dates[dates.length - 1]);
  const pastSchoolDays = dates.filter((d) => isSchoolDay(d) && d <= now);
  const days: S["RollBookDay"][] = dates.map((date) => {
    const marks = db().childAttendance[date] ?? {};
    const count = (m: ChildMark) => kids.filter((k) => marks[k.id] === m).length;
    return {
      date,
      weekday: weekday(date),
      schoolDay: isSchoolDay(date),
      holiday: holidayName(date),
      locked: false,
      editable: isSchoolDay(date) && date <= now && (ctx.user.isBgh || date === now),
      present: count("P"),
      excused: count("E"),
      absent: count("A"),
    };
  });
  const rows: S["RollBookRow"][] = kids.map((k) => {
    const activeFrom = k.enrolledOn > dates[0] ? k.enrolledOn : dates[0];
    const cells: Record<string, Status> = {};
    const notes: Record<string, string> = {};
    for (const date of dates) {
      const mark = db().childAttendance[date]?.[k.id];
      if (mark) cells[date] = STATUS[mark];
      const note = db().childNotes[`${k.id}|${date}`];
      if (note) notes[date] = note;
    }
    const values = Object.values(cells);
    const present = values.filter((v) => v === "PRESENT").length;
    const expected = pastSchoolDays.filter((d) => d >= activeFrom).length;
    return {
      childId: k.id,
      code: k.code,
      fullName: k.fullName,
      activeFrom,
      activeTo: dates[dates.length - 1],
      cells,
      notes,
      present,
      excused: values.filter((v) => v === "EXCUSED").length,
      absent: values.filter((v) => v === "ABSENT").length,
      rate: expected ? Math.round((present * 1000) / expected) / 10 : 0,
    };
  });
  return { classId: cls.id, className: cls.name, schoolId: cls.schoolId, month: `${month}-01`, days, rows: rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")) };
}

on("GET", "/classes/{id}/attendance/month", rollBook);

on("GET", "/classes/{id}/attendance/month/export", (ctx) => {
  const book = rollBook(ctx);
  const mark = (s?: Status) => (s ? CODE[MARK[s]] : "");
  return sheetFile(
    `Sổ điểm danh lớp ${book.className} tháng ${book.month.slice(5, 7)}/${book.month.slice(0, 4)}`,
    "Sổ điểm danh",
    ["Mã trẻ", "Họ tên", ...book.days.map((d) => String(Number(d.date.slice(8)))), "Có mặt", "P", "K", "Chuyên cần (%)"],
    [
      ...book.rows.map((r) => [r.code, r.fullName, ...book.days.map((d) => mark(r.cells[d.date])), r.present, r.excused, r.absent, r.rate]),
      ["", "Có mặt theo ngày", ...book.days.map((d) => (d.schoolDay ? d.present : "")), "", "", "", ""],
    ],
  );
});
