import * as XLSX from "xlsx";
import type { components } from "@/api/schema";
import { ATTENDANCE_CODES } from "@/features/attendance/codes";
import { db, type StaffRec } from "../db";
import { holidayName, monthDays, weekday } from "../dates";
import { type Ctx, FileBody, MockError, nowIso, on, requireBgh } from "../router";
import { isLocked } from "./common";

type S = components["schemas"];

const GRACE_MINUTES = 15;
const key = (staffId: string, date: string) => `${staffId}|${date}`;

function requireMonth(month: string | null): string {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new MockError(400, "Tháng không hợp lệ.");
  return month;
}

function days(month: string): S["DayInfo"][] {
  return monthDays(month).map((date) => {
    const w = weekday(date);
    return { date, weekday: w, working: w <= 6, halfDay: w === 6, holiday: holidayName(date) };
  });
}

function cellOf(staffId: string, date: string): S["Cell"] | undefined {
  const code = db().staffDays[staffId]?.[date];
  const disc = db().discrepancies[key(staffId, date)];
  if (!code && !disc) return undefined;
  const late = db().late[key(staffId, date)] ?? 0;
  const leave = code && !["X", "NL", "NN"].includes(code);
  return {
    code,
    lateMinutes: late,
    countedLate: late > GRACE_MINUTES,
    discrepancy: !!disc,
    source: leave ? "LEAVE" : "MACHINE",
    note: db().cellNotes[key(staffId, date)],
  };
}

/** Tổng tháng theo quy tắc ESG HR (đã sửa: 1/2P cộng 0,5 phép, 1/2K cộng 0,5 không lương). */
export function totals(cells: Record<string, S["Cell"]>): S["Totals"] {
  const t = { totalWork: 0, paidLeave: 0, unpaidLeave: 0, holidayLeave: 0, lateCount: 0 };
  for (const [date, cell] of Object.entries(cells)) {
    if (cell.countedLate) t.lateCount += 1;
    switch (cell.code) {
      case "X":
        t.totalWork += 1;
        break;
      case "NN":
        t.totalWork += 0.5;
        break;
      case "1/2P":
        t.totalWork += 0.5;
        t.paidLeave += 0.5;
        break;
      case "1/2K":
        t.totalWork += 0.5;
        t.unpaidLeave += 0.5;
        break;
      case "K":
        t.unpaidLeave += 1;
        break;
      case "P":
        t.paidLeave += 1;
        break;
      case "NL":
        if (weekday(date) <= 6) {
          t.totalWork += 1;
          t.holidayLeave += 1;
        }
        break;
    }
  }
  return t;
}

function row(s: StaffRec, month: string): S["StaffRow"] {
  const cells: Record<string, S["Cell"]> = {};
  for (const date of monthDays(month)) {
    const cell = cellOf(s.id, date);
    if (cell) cells[date] = cell;
  }
  const last = monthDays(month).pop()!;
  return {
    staffId: s.id,
    staffCode: s.staffCode,
    machineCode: s.machineCode,
    fullName: s.fullName,
    position: s.position,
    activeFrom: s.startDate > `${month}-01` ? s.startDate : `${month}-01`,
    activeTo: s.endDate && s.endDate < last ? s.endDate : last,
    cells,
    totals: totals(cells),
  };
}

function members(ctx: Ctx, month: string): StaffRec[] {
  return db().staff.filter((s) => s.schoolId === ctx.schoolId && s.startDate <= `${month}-31` && (!s.endDate || s.endDate >= `${month}-01`));
}

function sheet(ctx: Ctx, month: string): S["MonthSheet"] {
  const staff = members(ctx, month).map((s) => row(s, month));
  const lock = db().locks[`${ctx.schoolId}|${month}`];
  return {
    month,
    schoolId: ctx.schoolId,
    days: days(month),
    staff,
    discrepancyCount: staff.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.discrepancy).length, 0),
    lock,
    canManage: ctx.user.isBgh,
    canUnlock: ctx.user.role === "principal",
  };
}

function detail(ctx: Ctx, s: StaffRec, date: string): S["CellDetail"] {
  const cell = cellOf(s.id, date);
  const disc = db().discrepancies[key(s.id, date)];
  const machine = cell?.code === "X" || disc;
  const seed = (Number(s.machineCode) * 31 + Number(date.slice(8))) % 17;
  const inMinutes = 7 * 60 + 12 + seed + (cell?.lateMinutes ? 18 + cell.lateMinutes : 0);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return {
    staffId: s.id,
    fullName: s.fullName,
    date,
    code: cell?.code,
    lateMinutes: cell?.lateMinutes ?? 0,
    countedLate: cell?.countedLate ?? false,
    discrepancy: !!disc,
    discrepancyReason: disc?.reason,
    suggestedStatus: disc?.suggested,
    checkIn: machine ? hhmm(inMinutes) : undefined,
    checkOut: machine && !disc ? hhmm(weekday(date) === 6 ? 11 * 60 + 35 + seed : 17 * 60 + 2 + seed) : undefined,
    note: cell?.note,
    source: cell?.source,
    locked: isLocked(s.schoolId, date.slice(0, 7)),
  };
}

function requireMember(ctx: Ctx, staffId: string): StaffRec {
  const s = db().staff.find((x) => x.id === staffId && x.schoolId === ctx.schoolId);
  if (!s) throw new MockError(404, "Không tìm thấy nhân viên.");
  return s;
}

function requireOpen(ctx: Ctx, month: string) {
  if (isLocked(ctx.schoolId, month)) throw new MockError(409, "Tháng này đã khóa công, không sửa được.");
}

function setCode(staffId: string, date: string, code: string | undefined) {
  if (code && !(ATTENDANCE_CODES as readonly string[]).includes(code)) throw new MockError(400, "Mã công không hợp lệ.");
  const days = (db().staffDays[staffId] ??= {});
  if (code) days[date] = code;
  else delete days[date];
  delete db().discrepancies[key(staffId, date)];
}

on("GET", "/attendance/staff", (ctx) => {
  requireBgh(ctx);
  return sheet(ctx, requireMonth(ctx.query.get("month")));
});

on("GET", "/attendance/staff/{staffId}/{date}", (ctx) => {
  requireBgh(ctx);
  return detail(ctx, requireMember(ctx, ctx.params.staffId), ctx.params.date);
});

on("PUT", "/attendance/staff/{staffId}/{date}", (ctx) => {
  requireBgh(ctx);
  const s = requireMember(ctx, ctx.params.staffId);
  const { date } = ctx.params;
  requireOpen(ctx, date.slice(0, 7));
  setCode(s.id, date, ctx.body?.code);
  const note = ctx.body?.note?.trim();
  if (note) db().cellNotes[key(s.id, date)] = note;
  else delete db().cellNotes[key(s.id, date)];
  return detail(ctx, s, date);
});

on("GET", "/attendance/discrepancies", (ctx) => {
  requireBgh(ctx);
  const month = requireMonth(ctx.query.get("month"));
  const out: S["DiscrepancyItem"][] = [];
  for (const s of members(ctx, month)) {
    for (const date of monthDays(month)) {
      const disc = db().discrepancies[key(s.id, date)];
      if (!disc) continue;
      const d = detail(ctx, s, date);
      out.push({ staffId: s.id, staffCode: s.staffCode, fullName: s.fullName, date, reason: disc.reason, suggestedStatus: disc.suggested, code: d.code, checkIn: d.checkIn, checkOut: d.checkOut });
    }
  }
  return out;
});

on("POST", "/attendance/discrepancies/resolve", (ctx) => {
  requireBgh(ctx);
  const month = requireMonth(ctx.body?.month);
  requireOpen(ctx, month);
  const items = (ctx.body?.items ?? []) as S["ResolveItem"][];
  for (const item of items) setCode(requireMember(ctx, item.staffId).id, item.date, item.code);
  return { resolved: items.length };
});

on("POST", "/attendance/months/{month}/lock", (ctx) => {
  requireBgh(ctx);
  const month = requireMonth(ctx.params.month);
  requireOpen(ctx, month);
  if (sheet(ctx, month).discrepancyCount > 0) throw new MockError(409, "Còn ngày sai lệch chưa xử lý, không khóa được.");
  db().locks[`${ctx.schoolId}|${month}`] = { lockedAt: nowIso(), lockedByName: ctx.user.staff.fullName };
  return sheet(ctx, month);
});

on("POST", "/attendance/months/{month}/unlock", (ctx) => {
  if (ctx.user.role !== "principal") throw new MockError(403, "Chỉ hiệu trưởng được mở khóa công.");
  const month = requireMonth(ctx.params.month);
  if (!ctx.body?.reason?.trim()) throw new MockError(400, "Vui lòng nhập lý do mở khóa.");
  delete db().locks[`${ctx.schoolId}|${month}`];
  return sheet(ctx, month);
});

on("GET", "/attendance/months/{month}/export", (ctx) => {
  requireBgh(ctx);
  const month = requireMonth(ctx.params.month);
  const data = sheet(ctx, month);
  const header = ["Mã NV", "Họ tên", ...data.days.map((d) => Number(d.date.slice(8))), "Công", "Phép", "Không lương", "Lễ", "Đi muộn"];
  const rows = data.staff.map((r) => [
    r.staffCode,
    r.fullName,
    ...data.days.map((d) => r.cells[d.date]?.code ?? ""),
    r.totals.totalWork,
    r.totals.paidLeave,
    r.totals.unpaidLeave,
    r.totals.holidayLeave,
    r.totals.lateCount,
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[`Bảng công tháng ${month}`], header, ...rows]), "Bảng công");
  return new FileBody(XLSX.write(book, { type: "array", bookType: "xlsx" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

on("GET", "/me/attendance", (ctx) => {
  const month = requireMonth(ctx.query.get("month"));
  const r = row(ctx.user.staff, month);
  return {
    staffId: r.staffId,
    fullName: r.fullName,
    month,
    days: days(month),
    cells: r.cells,
    totals: r.totals,
    locked: isLocked(ctx.user.staff.schoolId, month),
  } satisfies S["MySheet"];
});

