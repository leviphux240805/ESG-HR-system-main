import { CODE_LABELS, type AttendanceCode } from "@/features/attendance/codes";
import { POSITION_LABELS } from "@/features/staff/labels";
import { db, type LeaveRec, type StaffRec } from "../db";
import { isWorkingDay } from "../attendanceConfig";
import { iso, range } from "../dates";
import { type Ctx, MockError, newId, nowIso } from "../router";

export const today = () => iso(new Date());

export function staffById(id: string): StaffRec | undefined {
  return db().staff.find((s) => s.id === id);
}

export function staffName(id: string): string {
  return staffById(id)?.fullName ?? "—";
}

export function positionLabel(staff: StaffRec | undefined): string {
  return staff ? POSITION_LABELS[staff.position] : "";
}

export function leaveLabel(code: string, halfDay = false): string {
  const label = CODE_LABELS[code as AttendanceCode] ?? code;
  return halfDay ? `${label} (nửa ngày)` : label;
}

/** Lớp mà giáo viên phụ trách (nếu có). */
export function classOfTeacher(staffId: string) {
  return db().classes.find((c) => c.teacherIds.includes(staffId));
}

/** Đơn nghỉ đã duyệt của nhân viên phủ ngày `date`. */
export function approvedLeaveOn(staffId: string, date: string): LeaveRec | undefined {
  return db().leaves.find((l) => l.staffId === staffId && l.status === "APPROVED" && l.fromDate <= date && l.toDate >= date);
}

export function schoolStaff(schoolId: string): StaffRec[] {
  return db().staff.filter((s) => s.schoolId === schoolId && s.status === "ACTIVE");
}

export function notify(staffId: string, title: string, body: string, link: string) {
  db().notifications.unshift({ id: newId(), staffId, title, body, link, createdAt: nowIso() });
}

export function isLocked(schoolId: string, month: string): boolean {
  return !!db().locks[`${schoolId}|${month}`];
}

/** Duyệt đơn nghỉ: ghi mã vào bảng công các ngày làm việc, thông báo người xin. */
export function approveLeave(leave: LeaveRec, ctx: Ctx, note?: string) {
  if (leave.status !== "PENDING") throw new MockError(409, "Đơn đã được xử lý.");
  if (leave.staffId === ctx.user.staff.id) throw new MockError(403, "Bạn không tự duyệt đơn của mình.");
  for (const date of range(leave.fromDate, leave.toDate)) {
    if (!isWorkingDay(leave.schoolId, date)) continue;
    if (isLocked(leave.schoolId, date.slice(0, 7))) throw new MockError(409, "Tháng này đã khóa công, không duyệt được.");
  }
  leave.status = "APPROVED";
  leave.reviewedAt = nowIso();
  leave.reviewerName = ctx.user.staff.fullName;
  leave.reviewNote = note || undefined;
  const days = (db().staffDays[leave.staffId] ??= {});
  for (const date of range(leave.fromDate, leave.toDate)) {
    if (isWorkingDay(leave.schoolId, date)) days[date] = leave.halfDay ? `1/2${leave.leaveCode}` : leave.leaveCode;
  }
  notify(leave.staffId, "Đơn nghỉ đã được duyệt", `${leaveLabel(leave.leaveCode, leave.halfDay)} · ${leave.fromDate}`, "/nghi-phep");
}

export function rejectLeave(leave: LeaveRec, ctx: Ctx, note: string) {
  if (leave.status !== "PENDING") throw new MockError(409, "Đơn đã được xử lý.");
  if (!note?.trim()) throw new MockError(400, "Vui lòng nhập lý do từ chối.");
  leave.status = "REJECTED";
  leave.reviewedAt = nowIso();
  leave.reviewerName = ctx.user.staff.fullName;
  leave.reviewNote = note.trim();
  notify(leave.staffId, "Đơn nghỉ bị từ chối", note.trim(), "/nghi-phep");
}
