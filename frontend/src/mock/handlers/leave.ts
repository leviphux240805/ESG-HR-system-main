import type { components } from "@/api/schema";
import { configAt, isWorkingDay } from "../attendanceConfig";
import { db, type LeaveRec } from "../db";
import { fileMeta, fileUrl } from "../files";
import { range } from "../dates";
import { workDaysBetween } from "../seed";
import { type Ctx, MockError, newId, notFound, nowIso, on, paginate, requireBgh } from "../router";
import { approveLeave, isLocked, notify, rejectLeave, schoolStaff, staffById } from "./common";

type LeaveRequestDto = components["schemas"]["LeaveRequestDto"];


function toDto(l: LeaveRec, ctx: Ctx): LeaveRequestDto {
  const staff = staffById(l.staffId);
  const own = l.staffId === ctx.user.staff.id;
  return {
    id: l.id,
    schoolId: l.schoolId,
    staffId: l.staffId,
    staffCode: staff?.staffCode ?? "",
    staffName: staff?.fullName ?? "",
    leaveCode: l.leaveCode,
    attendanceCode: l.halfDay ? `1/2${l.leaveCode}` : l.leaveCode,
    fromDate: l.fromDate,
    toDate: l.toDate,
    halfDay: l.halfDay,
    days: l.days,
    reason: l.reason,
    status: l.status,
    createdAt: l.createdAt,
    reviewNote: l.reviewNote,
    reviewedAt: l.reviewedAt,
    reviewerName: l.reviewerName,
    file: l.fileId && fileMeta(l.fileId) ? (({ id, originalName, mimeType, sizeBytes }) => ({ id, originalName, mimeType, sizeBytes }))(fileMeta(l.fileId)!) : undefined,
    canCancel: own && l.status === "PENDING",
    canReview: ctx.user.isBgh && !own && l.status === "PENDING",
  };
}

function schoolLeave(ctx: Ctx): LeaveRec {
  requireBgh(ctx);
  const leave = db().leaves.find((l) => l.id === ctx.params.id && l.schoolId === ctx.schoolId);
  if (!leave) notFound("đơn nghỉ");
  return leave;
}

function balance(staffId: string, year: number) {
  const mine = db().leaves.filter((l) => l.staffId === staffId && l.leaveCode === "P" && l.fromDate.startsWith(String(year)));
  const usedDays = mine.filter((l) => l.status === "APPROVED").reduce((s, l) => s + l.days, 0);
  const pendingDays = mine.filter((l) => l.status === "PENDING").reduce((s, l) => s + l.days, 0);
  const school = staffById(staffId)?.schoolId ?? "";
  const annualDays = configAt(school, `${year}-12-31`).annualLeaveDays;
  return { year, annualDays, usedDays, pendingDays, remaining: annualDays - usedDays };
}

on("GET", "/me/leave-requests", (ctx) =>
  db()
    .leaves.filter((l) => l.staffId === ctx.user.staff.id)
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
    .map((l) => toDto(l, ctx)),
);

on("GET", "/me/leave-balance", (ctx) => balance(ctx.user.staff.id, Number(ctx.query.get("year") ?? new Date().getFullYear())));

on("POST", "/me/leave-requests", (ctx) => {
  const { leaveCode, fromDate, toDate, halfDay, reason, fileId } = ctx.body ?? {};
  if (!leaveCode || !fromDate || !toDate) throw new MockError(400, "Vui lòng nhập đủ loại nghỉ và thời gian.");
  if (toDate < fromDate) throw new MockError(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  if (!reason?.trim()) throw new MockError(400, "Vui lòng nhập lý do.");
  const staffId = ctx.user.staff.id;
  const days = halfDay ? 0.5 : workDaysBetween(fromDate, toDate);
  if (days === 0) throw new MockError(400, "Khoảng thời gian không có ngày làm việc.");
  if (db().leaves.some((l) => l.staffId === staffId && ["PENDING", "APPROVED"].includes(l.status) && l.fromDate <= toDate && l.toDate >= fromDate)) {
    throw new MockError(409, "Bạn đã có đơn nghỉ trùng thời gian này.");
  }
  if (range(fromDate, toDate).some((d) => isWorkingDay(ctx.user.staff.schoolId, d) && isLocked(ctx.user.staff.schoolId, d.slice(0, 7)))) {
    throw new MockError(409, "Tháng này đã khóa công, không xin nghỉ được.");
  }
  if (leaveCode === "P") {
    const b = balance(staffId, Number(fromDate.slice(0, 4)));
    if (b.remaining - b.pendingDays < days) throw new MockError(400, `Phép năm còn lại không đủ (còn ${b.remaining - b.pendingDays} ngày).`);
  }
  const leave: LeaveRec = {
    id: newId(),
    schoolId: ctx.user.staff.schoolId,
    staffId,
    leaveCode,
    fromDate,
    toDate,
    halfDay: !!halfDay,
    days,
    reason: reason.trim(),
    status: "PENDING",
    createdAt: nowIso(),
    fileId,
  };
  db().leaves.push(leave);
  for (const s of schoolStaff(leave.schoolId).filter((s) => s.position === "MANAGER")) {
    notify(s.id, "Có đơn nghỉ mới chờ duyệt", `${ctx.user.staff.fullName} xin nghỉ từ ${fromDate}.`, "/hop-duyet");
  }
  return toDto(leave, ctx);
});

on("POST", "/me/leave-requests/{id}/cancel", (ctx) => {
  const leave = db().leaves.find((l) => l.id === ctx.params.id && l.staffId === ctx.user.staff.id);
  if (!leave) notFound("đơn nghỉ");
  if (leave.status !== "PENDING") throw new MockError(409, "Chỉ hủy được đơn đang chờ duyệt.");
  leave.status = "CANCELLED";
  return toDto(leave, ctx);
});

on("GET", "/leave-requests", (ctx) => {
  requireBgh(ctx);
  const status = ctx.query.get("status");
  const list = db()
    .leaves.filter((l) => l.schoolId === ctx.schoolId && (!status || l.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((l) => toDto(l, ctx));
  return paginate(list, ctx.query);
});

on("POST", "/leave-requests/{id}/approve", (ctx) => {
  const leave = schoolLeave(ctx);
  approveLeave(leave, ctx, ctx.body?.note);
  return toDto(leave, ctx);
});

on("POST", "/leave-requests/{id}/reject", (ctx) => {
  const leave = schoolLeave(ctx);
  rejectLeave(leave, ctx, ctx.body?.note);
  return toDto(leave, ctx);
});

on("POST", "/leave-requests/approve", (ctx) => {
  requireBgh(ctx);
  const failed: { id: string; message: string }[] = [];
  let approved = 0;
  for (const id of (ctx.body?.ids ?? []) as string[]) {
    const leave = db().leaves.find((l) => l.id === id && l.schoolId === ctx.schoolId);
    try {
      if (!leave) notFound("đơn nghỉ");
      approveLeave(leave, ctx, ctx.body?.note);
      approved += 1;
    } catch (e) {
      failed.push({ id, message: (e as Error).message });
    }
  }
  return { approved, failed };
});

on("GET", "/leave-requests/calendar", (ctx) => {
  requireBgh(ctx);
  const month = ctx.query.get("month") ?? "";
  return db()
    .leaves.filter((l) => l.schoolId === ctx.schoolId && l.status === "APPROVED" && l.fromDate.slice(0, 7) <= month && l.toDate.slice(0, 7) >= month)
    .map((l) => ({
      requestId: l.id,
      staffId: l.staffId,
      staffName: staffById(l.staffId)?.fullName ?? "",
      fromDate: l.fromDate,
      toDate: l.toDate,
      attendanceCode: l.halfDay ? `1/2${l.leaveCode}` : l.leaveCode,
    }));
});

on("GET", "/leave-requests/{id}/file-url", (ctx) => {
  const leave = db().leaves.find((l) => l.id === ctx.params.id && (l.staffId === ctx.user.staff.id || (ctx.user.isBgh && ctx.schoolIds.includes(l.schoolId))));
  if (!leave?.fileId) notFound("tệp đính kèm");
  return { url: fileUrl(leave.fileId), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
});
