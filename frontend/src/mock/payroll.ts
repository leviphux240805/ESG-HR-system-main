import type { components } from "@/api/schema";
import { db, type StaffRec } from "./db";

type S = components["schemas"];
type SalaryConfig = S["SalaryConfigDto"];

// Bản demo của PayrollCalculator (backend): cùng công thức và tham số mặc định của bảng payroll_params.

export const PARAMS = {
  socialRate: 0.08,
  healthRate: 0.015,
  unemploymentRate: 0.01,
  personalDeduction: 11_000_000,
  dependentDeduction: 4_400_000,
  baseSalary: 2_340_000,
  capMultiplier: 20,
  regionMinWages: { I: 4_960_000, II: 4_410_000, III: 3_860_000, IV: 3_450_000 } as Record<string, number>,
  brackets: [
    { upTo: 5_000_000, rate: 0.05 },
    { upTo: 10_000_000, rate: 0.1 },
    { upTo: 18_000_000, rate: 0.15 },
    { upTo: 32_000_000, rate: 0.2 },
    { upTo: 52_000_000, rate: 0.25 },
    { upTo: 80_000_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ] as { upTo: number | null; rate: number }[],
};

export interface PayrollInput {
  workDays: number;
  standardWorkDays: number;
  config: SalaryConfig;
  bonus: number;
  fines: number;
  dependentCount: number;
}

/** Thuế lũy tiến từng phần. */
export function progressiveTax(taxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const b of PARAMS.brackets) {
    const upper = b.upTo === null ? taxable : Math.min(b.upTo, taxable);
    if (upper > lower) tax += (upper - lower) * b.rate;
    if (b.upTo === null || taxable <= b.upTo) break;
    lower = b.upTo;
  }
  return Math.round(tax);
}

export function calculate(input: PayrollInput) {
  const c = input.config;
  const contract = Math.round(c.salaryMode === "COEFFICIENT" ? (c.coefficient ?? 0) * PARAMS.baseSalary : (c.baseSalary ?? 0));
  const salaryByWork = Math.round((contract * input.workDays) / input.standardWorkDays);
  const allowances: Record<string, number> = {};
  for (const [key, value] of Object.entries((c.allowances ?? {}) as Record<string, number>)) {
    if (key === "seniorityPercent") allowances.seniority = Math.round((contract * value) / 100);
    else if (value) allowances[key] = Math.round(value);
  }
  const allowanceTotal = Object.values(allowances).reduce((s, v) => s + v, 0);
  const gross = salaryByWork + allowanceTotal + input.bonus - input.fines;
  const insuranceBase = c.insuranceSalary ?? contract;
  const socialBase = Math.min(insuranceBase, PARAMS.baseSalary * PARAMS.capMultiplier);
  const regionWage = c.region ? PARAMS.regionMinWages[c.region] : undefined;
  const unemploymentBase = regionWage ? Math.min(insuranceBase, regionWage * PARAMS.capMultiplier) : insuranceBase;
  const social = Math.round(socialBase * PARAMS.socialRate);
  const health = Math.round(socialBase * PARAMS.healthRate);
  const unemployment = Math.round(unemploymentBase * PARAMS.unemploymentRate);
  const insurance = social + health + unemployment;
  const totalDeduction = PARAMS.personalDeduction + PARAMS.dependentDeduction * input.dependentCount + insurance;
  const taxable = Math.max(0, gross - totalDeduction);
  const pit = progressiveTax(taxable);
  return { contract, salaryByWork, allowances, allowanceTotal, gross, social, health, unemployment, insurance, totalDeduction, taxable, pit, net: gross - insurance - pit };
}

/** Lương mặc định theo vị trí khi nhân viên demo chưa có cấu hình lương. */
const DEFAULT_SALARY: Record<StaffRec["position"], number> = {
  MANAGER: 14_000_000,
  TEACHER: 8_000_000,
  NANNY: 6_200_000,
  COOK: 6_500_000,
  NURSE: 7_200_000,
  ACCOUNTANT: 9_000_000,
  SECURITY: 5_800_000,
  OTHER: 6_000_000,
};

/** Cấu hình lương hiệu lực tại ngày `date`. */
export function salaryConfigAt(staff: StaffRec, date: string): SalaryConfig {
  const own = (db().salaryConfigs?.[staff.id] ?? []).filter((c) => c.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return (
    own ?? {
      id: `default-${staff.id}`,
      effectiveFrom: staff.startDate,
      salaryMode: "FIXED",
      baseSalary: DEFAULT_SALARY[staff.position],
      region: "I",
      allowances: { lunch: 730_000 },
      current: true,
      createdAt: staff.startDate,
    }
  );
}

export function dependentCount(staffId: string, month: string): number {
  return (db().dependents[staffId] ?? []).filter((d) => (!d.fromMonth || d.fromMonth.slice(0, 7) <= month) && (!d.toMonth || d.toMonth.slice(0, 7) >= month)).length;
}
