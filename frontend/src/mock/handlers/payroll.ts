import type { components } from "@/api/schema";
import { ALLOWANCE_LABELS } from "@/features/staff/labels";
import { configAt } from "../attendanceConfig";
import { db, type PayrollPeriodRec, type PayrollRecordRec, type StaffRec } from "../db";
import { monthDays, shiftMonthStr, weekday } from "../dates";
import { calculate, dependentCount, PARAMS, salaryConfigAt } from "../payroll";
import { payslipPdf } from "../pdf";
import { type Ctx, FileBody, MockError, newId, notFound, nowIso, on } from "../router";
import { isLocked, notify, staffById, today } from "./common";
import { row as timesheetRow } from "./attendance";
import { sheetFile } from "./reports";

type S = components["schemas"];

// Bản demo của PayrollService: hiệu trưởng tính, sửa, duyệt, trả; nhân viên xem phiếu của mình khi đã duyệt.

const canManage = (ctx: Ctx) => ctx.user.role === "principal";
const LABELS: Record<string, string> = { ...ALLOWANCE_LABELS, seniority: "Thâm niên" };

function requireManage(ctx: Ctx) {
  if (!canManage(ctx)) throw new MockError(403, "Bạn không có quyền xem bảng lương của trường này.");
}

function requireMonth(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new MockError(400, "Tháng không hợp lệ (định dạng yyyy-MM).");
  return value;
}

function standardWorkDays(schoolId: string, month: string): number {
  return monthDays(month).reduce((sum, date) => {
    const cfg = configAt(schoolId, date);
    const w = weekday(date);
    return sum + (cfg.workingWeekdays.includes(w) ? (cfg.halfDayWeekdays.includes(w) ? 0.5 : 1) : 0);
  }, 0);
}

function computeRecord(staff: StaffRec, month: string, standard: number, keep?: PayrollRecordRec): PayrollRecordRec {
  const totals = timesheetRow(staff, month).totals;
  const workDays = totals.totalWork + totals.paidLeave;
  const config = salaryConfigAt(staff, `${month}-31`);
  const bonus = keep?.bonus ?? 0;
  const fines = keep?.fines ?? 0;
  const deps = keep?.dependentCount ?? dependentCount(staff.id, month);
  const r = calculate({ workDays, standardWorkDays: standard, config, bonus, fines, dependentCount: deps });
  return {
    id: keep?.id ?? newId(),
    staffId: staff.id,
    workDays,
    salaryMode: config.salaryMode,
    coefficient: config.coefficient,
    contract: r.contract,
    salaryByWork: r.salaryByWork,
    allowances: r.allowances,
    allowanceTotal: r.allowanceTotal,
    bonus,
    fines,
    gross: r.gross,
    social: r.social,
    health: r.health,
    unemployment: r.unemployment,
    insurance: r.insurance,
    dependentCount: deps,
    totalDeduction: r.totalDeduction,
    taxable: r.taxable,
    pit: r.pit,
    net: r.net,
    note: keep?.note,
  };
}

function members(schoolId: string, month: string): StaffRec[] {
  return db().staff.filter((s) => s.schoolId === schoolId && s.startDate <= `${month}-31` && (!s.endDate || s.endDate >= `${month}-01`));
}

function build(schoolId: string, month: string, existing?: PayrollPeriodRec): PayrollPeriodRec {
  const standard = standardWorkDays(schoolId, month);
  const keep = new Map(existing?.records.map((r) => [r.staffId, r]));
  return {
    id: existing?.id ?? newId(),
    schoolId,
    month,
    status: "DRAFT",
    standardWorkDays: standard,
    calculatedAt: nowIso(),
    records: members(schoolId, month).map((s) => computeRecord(s, month, standard, keep.get(s.id))),
  };
}

/** Bảng lương mẫu: tháng trước đã duyệt, hai tháng trước đã trả (bảng công các tháng này đã khóa ở dữ liệu mẫu). */
function periods(): PayrollPeriodRec[] {
  if (!db().payrollPeriods) {
    const month = today().slice(0, 7);
    db().payrollPeriods = db().schools.flatMap((school) =>
      [shiftMonthStr(month, -2), shiftMonthStr(month, -1)]
        .filter((m) => isLocked(school.id, m))
        .map((m, i) => ({ ...build(school.id, m), status: i === 0 ? ("PAID" as const) : ("APPROVED" as const), approvedAt: `${shiftMonthStr(m, 1)}-04T09:00:00+07:00`, approvedByName: staffById(db().users.principal.staffId)?.fullName, paidAt: i === 0 ? `${shiftMonthStr(m, 1)}-05T09:00:00+07:00` : undefined })),
    );
  }
  return db().payrollPeriods!;
}

const findPeriod = (schoolId: string, month: string) => periods().find((p) => p.schoolId === schoolId && p.month === month);

function toRow(r: PayrollRecordRec): S["PayrollRow"] {
  const s = staffById(r.staffId)!;
  return {
    id: r.id,
    staffId: s.id,
    staffCode: s.staffCode,
    fullName: s.fullName,
    position: s.position,
    workDays: r.workDays,
    salaryMode: r.salaryMode,
    contractSalary: r.contract,
    salaryByWork: r.salaryByWork,
    allowances: r.allowanceTotal,
    bonus: r.bonus,
    fines: r.fines,
    grossSalary: r.gross,
    insuranceDeduction: r.insurance,
    pit: r.pit,
    netSalary: r.net,
    dependentCount: r.dependentCount,
    note: r.note,
  };
}

function sheet(ctx: Ctx, month: string): S["PayrollSheet"] {
  const period = findPeriod(ctx.schoolId, month);
  const rows = (period?.records ?? []).map(toRow).sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
  const sum = (key: "grossSalary" | "insuranceDeduction" | "pit" | "netSalary") => rows.reduce((s, r) => s + r[key], 0);
  return {
    month: `${month}-01`,
    schoolId: ctx.schoolId,
    status: period?.status,
    standardWorkDays: period?.standardWorkDays,
    calculatedAt: period?.calculatedAt,
    approvedAt: period?.approvedAt,
    approvedByName: period?.approvedByName,
    paidAt: period?.paidAt,
    attendanceLocked: isLocked(ctx.schoolId, month),
    canEdit: canManage(ctx),
    canApprove: canManage(ctx),
    rows,
    missingConfig: [],
    totals: { grossSalary: sum("grossSalary"), insuranceDeduction: sum("insuranceDeduction"), pit: sum("pit"), netSalary: sum("netSalary") },
  };
}

function requirePeriod(ctx: Ctx): PayrollPeriodRec {
  requireManage(ctx);
  const period = findPeriod(ctx.schoolId, requireMonth(ctx.params.month));
  if (!period) notFound("bảng lương tháng này");
  return period;
}

const requireDraft = (p: PayrollPeriodRec) => {
  if (p.status !== "DRAFT") throw new MockError(409, "Bảng lương đã duyệt, không sửa được; hiệu trưởng có thể mở lại.");
};

on("GET", "/payroll/periods/{month}", (ctx) => {
  requireManage(ctx);
  return sheet(ctx, requireMonth(ctx.params.month));
});

on("POST", "/payroll/periods/{month}/calculate", (ctx) => {
  requireManage(ctx);
  const month = requireMonth(ctx.params.month);
  if (!isLocked(ctx.schoolId, month)) throw new MockError(409, "Cần khóa bảng công tháng này trước khi tính lương.");
  const existing = findPeriod(ctx.schoolId, month);
  if (existing) requireDraft(existing);
  const next = build(ctx.schoolId, month, existing);
  db().payrollPeriods = [...periods().filter((p) => p !== existing), next];
  return sheet(ctx, month);
});

on("PUT", "/payroll/records/{id}", (ctx) => {
  requireManage(ctx);
  const period = periods().find((p) => p.schoolId === ctx.schoolId && p.records.some((r) => r.id === ctx.params.id));
  if (!period) notFound("dòng lương");
  requireDraft(period);
  const body = ctx.body as S["AdjustRequest"];
  if (body.bonus < 0 || body.fines < 0) throw new MockError(400, "Số tiền không được âm.");
  const index = period.records.findIndex((r) => r.id === ctx.params.id);
  const old = period.records[index];
  const updated = computeRecord(staffById(old.staffId)!, period.month, period.standardWorkDays, { ...old, bonus: body.bonus, fines: body.fines, note: body.note?.trim() || undefined });
  period.records[index] = updated;
  return toRow(updated);
});

on("POST", "/payroll/periods/{month}/approve", (ctx) => {
  const period = requirePeriod(ctx);
  requireDraft(period);
  if (!period.records.length) throw new MockError(409, "Bảng lương chưa có dòng nào, hãy tính lương trước.");
  Object.assign(period, { status: "APPROVED", approvedAt: nowIso(), approvedByName: ctx.user.staff.fullName });
  const [y, m] = period.month.split("-");
  for (const r of period.records) notify(r.staffId, `Đã có phiếu lương tháng ${Number(m)}/${y}`, "Xem chi tiết ở Phiếu lương của tôi.", "/cua-toi/phieu-luong");
  return sheet(ctx, period.month);
});

on("POST", "/payroll/periods/{month}/reopen", (ctx) => {
  const period = requirePeriod(ctx);
  if (period.status !== "APPROVED") throw new MockError(409, "Chỉ mở lại được bảng lương đã duyệt, chưa trả.");
  if (!ctx.body?.reason?.trim()) throw new MockError(400, "Vui lòng nhập lý do mở lại.");
  Object.assign(period, { status: "DRAFT", approvedAt: undefined, approvedByName: undefined });
  return sheet(ctx, period.month);
});

on("POST", "/payroll/periods/{month}/pay", (ctx) => {
  const period = requirePeriod(ctx);
  if (period.status !== "APPROVED") throw new MockError(409, "Bảng lương cần được duyệt trước khi trả.");
  Object.assign(period, { status: "PAID", paidAt: nowIso() });
  return sheet(ctx, period.month);
});

on("GET", "/payroll/periods/{month}/export", (ctx) => {
  requireManage(ctx);
  const s = sheet(ctx, requireMonth(ctx.params.month));
  return sheetFile(
    `Bảng lương tháng ${ctx.params.month}`,
    "Bảng lương",
    ["Mã NV", "Họ tên", "Công", "Lương theo công", "Phụ cấp", "Thưởng", "Phạt", "Tổng thu nhập", "Bảo hiểm", "Thuế TNCN", "Thực lĩnh"],
    s.rows.map((r) => [r.staffCode, r.fullName, r.workDays, r.salaryByWork, r.allowances, r.bonus, r.fines, r.grossSalary, r.insuranceDeduction, r.pit, r.netSalary]),
  );
});

/** Phiếu lương: người quản lý lương của trường, hoặc chính nhân viên khi bảng đã duyệt. */
function payslip(ctx: Ctx): S["Payslip"] {
  const period = periods().find((p) => p.records.some((r) => r.id === ctx.params.id));
  const r = period?.records.find((x) => x.id === ctx.params.id);
  const own = r?.staffId === ctx.user.staff.id && period?.status !== "DRAFT";
  if (!period || !r || (!own && !(canManage(ctx) && ctx.schoolIds.includes(period.schoolId)))) notFound("phiếu lương");
  const s = staffById(r.staffId)!;
  return {
    id: r.id,
    month: `${period.month}-01`,
    status: period.status,
    schoolName: db().schools.find((x) => x.id === period.schoolId)?.name ?? "",
    staffCode: s.staffCode,
    fullName: s.fullName,
    position: s.position,
    workDays: r.workDays,
    standardWorkDays: period.standardWorkDays,
    salaryMode: r.salaryMode,
    coefficient: r.coefficient,
    contractSalary: r.contract,
    salaryByWork: r.salaryByWork,
    allowances: r.allowances,
    bonus: r.bonus,
    fines: r.fines,
    grossSalary: r.gross,
    socialInsurance: r.social,
    healthInsurance: r.health,
    unemploymentInsurance: r.unemployment,
    dependentCount: r.dependentCount,
    totalDeduction: r.totalDeduction,
    taxableIncome: r.taxable,
    pit: r.pit,
    netSalary: r.net,
    note: r.note,
  };
}

on("GET", "/payroll/records/{id}", payslip);

on("GET", "/payroll/records/{id}/pdf", (ctx) => {
  if (typeof document === "undefined") throw new MockError(501, "Cần trình duyệt để tạo PDF.");
  return new FileBody(payslipPdf(payslip(ctx), (key) => (LABELS[key] ?? key).toLowerCase()), "application/pdf");
});

on("GET", "/me/payslips", (ctx): S["MyPayslip"][] =>
  periods()
    .filter((p) => p.status !== "DRAFT")
    .flatMap((p) =>
      p.records
        .filter((r) => r.staffId === ctx.user.staff.id)
        .map((r) => ({ id: r.id, month: `${p.month}-01`, schoolName: db().schools.find((x) => x.id === p.schoolId)?.name ?? "", status: p.status, netSalary: r.net })),
    )
    .sort((a, b) => b.month.localeCompare(a.month)),
);

on("GET", "/payroll/params", (): S["ParamsDto"] => ({
  effectiveFrom: "2024-07-01",
  socialInsuranceRate: PARAMS.socialRate,
  healthInsuranceRate: PARAMS.healthRate,
  unemploymentInsuranceRate: PARAMS.unemploymentRate,
  personalDeduction: PARAMS.personalDeduction,
  dependentDeduction: PARAMS.dependentDeduction,
  baseSalary: PARAMS.baseSalary,
  note: "Số tham khảo, cần đối chiếu văn bản hiện hành",
}));
