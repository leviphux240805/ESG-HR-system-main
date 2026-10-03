import type { components } from "@/api/schema";
import { ATTENDANCE_CODES } from "@/features/attendance/codes";
import { configAt, configVersions, minutesOf } from "../attendanceConfig";
import { db, type StaffRec } from "../db";
import { holidayName, monthDays, nationalHoliday, range, weekday } from "../dates";
import { sheetFile } from "../excel";
import { type Ctx, MockError, newId, nowIso, on, requireBgh } from "../router";
import { isLocked } from "./common";

type S = components["schemas"];

const key = (staffId: string, date: string) => `${staffId}|${date}`;

function requireMonth(month: string | null): string {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new MockError(400, "Tháng không hợp lệ.");
  return month;
}

function days(schoolId: string, month: string): S["DayInfo"][] {
  return monthDays(month).map((date) => {
    const w = weekday(date);
    const cfg = configAt(schoolId, date);
    return { date, weekday: w, working: cfg.workingWeekdays.includes(w), halfDay: cfg.halfDayWeekdays.includes(w), holiday: holidayName(date, schoolId) };
  });
}

function cellOf(staffId: string, date: string, grace: number): S["Cell"] | undefined {
  const code = db().staffDays[staffId]?.[date];
  const disc = db().discrepancies[key(staffId, date)];
  if (!code && !disc) return undefined;
  const late = db().late[key(staffId, date)] ?? 0;
  const leave = code && !["X", "NL", "NN"].includes(code);
  return {
    code,
    lateMinutes: late,
    countedLate: late > grace,
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

/** Một dòng bảng công tháng của nhân viên (cũng dùng để tính lương ở bản demo). */
export function row(s: StaffRec, month: string): S["StaffRow"] {
  const cells: Record<string, S["Cell"]> = {};
  for (const date of monthDays(month)) {
    const cell = cellOf(s.id, date, configAt(s.schoolId, date).graceMinutes);
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
    days: days(ctx.schoolId, month),
    staff,
    discrepancyCount: staff.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.discrepancy).length, 0),
    lock,
    canManage: ctx.user.isBgh,
    canUnlock: ctx.user.role === "principal",
  };
}

function detail(ctx: Ctx, s: StaffRec, date: string): S["CellDetail"] {
  const cell = cellOf(s.id, date, configAt(s.schoolId, date).graceMinutes);
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

/** Bảng công tháng dạng Excel (dùng chung cho trang Chấm công và Báo cáo). */
export function timesheetFile(ctx: Ctx, month: string) {
  const data = sheet(ctx, month);
  const header = ["Mã NV", "Họ tên", ...data.days.map((d) => String(Number(d.date.slice(8)))), "Công", "Phép", "Không lương", "Lễ", "Đi muộn"];
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
  return sheetFile(`Bảng công tháng ${month}`, "Bảng công", header, rows);
}

on("GET", "/attendance/months/{month}/export", (ctx) => {
  requireBgh(ctx);
  return timesheetFile(ctx, requireMonth(ctx.params.month));
});

on("GET", "/me/attendance", (ctx) => {
  const month = requireMonth(ctx.query.get("month"));
  const r = row(ctx.user.staff, month);
  return {
    staffId: r.staffId,
    fullName: r.fullName,
    month,
    days: days(ctx.user.staff.schoolId, month),
    cells: r.cells,
    totals: r.totals,
    locked: isLocked(ctx.user.staff.schoolId, month),
  } satisfies S["MySheet"];
});

// ---- Cấu hình chấm công, ngày lễ ----

on("GET", "/attendance/configs", (ctx): S["ConfigOverview"] => {
  requireBgh(ctx);
  const schoolId = ctx.query.get("schoolId") ?? ctx.schoolId;
  if (!ctx.schoolIds.includes(schoolId)) throw new MockError(403, "Bạn không có quyền với trường này.");
  const versions = configVersions(schoolId);
  return { canManage: true, effective: configAt(schoolId, new Date().toLocaleDateString("sv-SE")), versions };
});

on("POST", "/attendance/configs", (ctx) => {
  requireBgh(ctx);
  const body = ctx.body as S["CreateConfigRequest"];
  const schoolId = body.schoolId ?? ctx.schoolId;
  if (!ctx.schoolIds.includes(schoolId)) throw new MockError(403, "Bạn không có quyền với trường này.");
  if (minutesOf(body.shiftEnd) <= minutesOf(body.shiftStart)) throw new MockError(400, "Giờ tan ca phải sau giờ vào ca.");
  if (!body.workingWeekdays?.length) throw new MockError(400, "Chọn ít nhất một ngày làm việc.");
  if (configVersions(schoolId).some((c) => c.effectiveFrom === body.effectiveFrom)) throw new MockError(409, "Đã có cấu hình hiệu lực từ ngày này.");
  const config: S["ConfigDto"] = { ...body, id: newId(), schoolId };
  db().attendanceConfigs!.push(config);
  return config;
});

on("GET", "/holidays", (ctx): S["HolidayDto"][] => {
  const year = Number(ctx.query.get("year") ?? new Date().getFullYear());
  const national = range(`${year}-01-01`, `${year}-12-31`)
    .filter((d) => nationalHoliday(d))
    .map((date) => ({ id: `nat-${date}`, date, name: nationalHoliday(date)!, canManage: false }));
  const custom = (db().customHolidays ?? [])
    .filter((h) => h.date.startsWith(`${year}-`) && (!h.schoolId || ctx.schoolIds.includes(h.schoolId)))
    .map((h) => ({ ...h, schoolName: db().schools.find((x) => x.id === h.schoolId)?.name, canManage: h.schoolId ? ctx.user.isBgh : ctx.user.role === "principal" }));
  return [...national, ...custom].sort((a, b) => a.date.localeCompare(b.date));
});

on("POST", "/holidays", (ctx): S["HolidayDto"][] => {
  const body = ctx.body as S["CreateHolidayRequest"];
  if (body.schoolId ? !ctx.user.isBgh || !ctx.schoolIds.includes(body.schoolId) : ctx.user.role !== "principal")
    throw new MockError(403, "Bạn không có quyền thêm ngày lễ này.");
  if (!body.name?.trim()) throw new MockError(400, "Vui lòng nhập tên ngày lễ.");
  const to = body.toDate ?? body.fromDate;
  if (to < body.fromDate) throw new MockError(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  const list = (db().customHolidays ??= []);
  const added = range(body.fromDate, to)
    .filter((date) => !nationalHoliday(date) && !list.some((h) => h.date === date && h.schoolId === body.schoolId))
    .map((date) => ({ id: newId(), date, name: body.name.trim(), schoolId: body.schoolId }));
  list.push(...added);
  return added.map((h) => ({ ...h, canManage: true }));
});

on("DELETE", "/holidays/{id}", (ctx) => {
  const h = db().customHolidays?.find((x) => x.id === ctx.params.id);
  if (!h) throw new MockError(ctx.params.id.startsWith("nat-") ? 403 : 404, ctx.params.id.startsWith("nat-") ? "Ngày lễ quốc gia không xóa được." : "Không tìm thấy ngày lễ.");
  if (h.schoolId ? !ctx.user.isBgh : ctx.user.role !== "principal") throw new MockError(403, "Bạn không có quyền xóa ngày lễ này.");
  db().customHolidays = db().customHolidays!.filter((x) => x.id !== h.id);
});

// ---- Import máy chấm công (đối soát rút gọn của bản demo) ----

on("POST", "/attendance/imports", (ctx): S["ImportResult"] => {
  requireBgh(ctx);
  const { month, rows } = ctx.body as S["ImportRequest"];
  requireMonth(month);
  requireOpen(ctx, month);
  const byCode = new Map(members(ctx, month).filter((s) => s.machineCode).map((s) => [s.machineCode!, s]));
  const unmatched = new Map<string, S["UnmatchedCode"]>();
  const staffIds = new Set<string>();
  let matched = 0;
  let autoFilled = 0;
  let discrepancies = 0;
  for (const row of rows) {
    const s = byCode.get(row.machineCode);
    if (!s) {
      const u = unmatched.get(row.machineCode) ?? { machineCode: row.machineCode, name: row.name, rows: 0 };
      u.rows += 1;
      unmatched.set(row.machineCode, u);
      continue;
    }
    matched += 1;
    staffIds.add(s.id);
    const cfg = configAt(s.schoolId, row.workDate);
    const k = key(s.id, row.workDate);
    const existing = db().staffDays[s.id]?.[row.workDate];
    if (row.checkIn && /^\d{1,2}:\d{2}/.test(row.checkIn)) {
      db().late[k] = Math.max(0, minutesOf(row.checkIn.padStart(5, "0")) - minutesOf(cfg.shiftStart));
    }
    if (row.checkIn && row.checkOut) {
      if (!existing || existing === "X") {
        setCode(s.id, row.workDate, "X");
        autoFilled += 1;
      }
    } else if (row.checkIn || row.checkOut) {
      db().discrepancies[k] = { reason: row.checkIn ? "Thiếu giờ ra" : "Thiếu giờ vào", suggested: "X" };
      discrepancies += 1;
    }
  }
  return { batchId: newId(), rowCount: rows.length, matchedRows: matched, staffCount: staffIds.size, autoFilled, discrepancyCount: discrepancies, unmatched: [...unmatched.values()] };
});

