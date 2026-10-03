import { describe, expect, it } from "vitest";
import type { components } from "@/api/schema";
import { calculate } from "./payroll";

type Config = components["schemas"]["SalaryConfigDto"];

// Cùng các ca của PayrollCalculatorTests (backend): bản demo phải ra đúng số như bản thật.

const config = (patch: Partial<Config>): Config => ({ id: "c", effectiveFrom: "2024-01-01", salaryMode: "FIXED", region: "I", allowances: {}, current: true, createdAt: "2024-01-01", ...patch });
const run = (patch: Partial<Config>, workDays = 26, dependentCount = 0) =>
  calculate({ workDays, standardWorkDays: 26, config: config(patch), bonus: 0, fines: 0, dependentCount });

describe("calculate (bản demo của PayrollCalculator)", () => {
  it("lương cứng đủ công, phụ cấp, thuế bậc 2", () => {
    const r = run({ baseSalary: 20_000_000, allowances: { lunch: 730_000, transport: 500_000 } });
    expect(r).toMatchObject({ salaryByWork: 20_000_000, allowanceTotal: 1_230_000, gross: 21_230_000, social: 1_600_000, health: 300_000, unemployment: 200_000, taxable: 8_130_000, pit: 563_000, net: 18_567_000 });
  });

  it("lương hệ số thiếu công: bảo hiểm theo lương hợp đồng, không thuế", () => {
    const r = run({ salaryMode: "COEFFICIENT", coefficient: 3.5 }, 22);
    expect(r).toMatchObject({ contract: 8_190_000, salaryByWork: 6_930_000, insurance: 859_950, taxable: 0, pit: 0, net: 6_070_050 });
  });

  it("hai người phụ thuộc giảm thuế", () => {
    expect(run({ baseSalary: 30_000_000 }, 26, 2)).toMatchObject({ insurance: 3_150_000, totalDeduction: 22_950_000, taxable: 7_050_000, pit: 455_000, net: 26_395_000 });
  });

  it("trần đóng bảo hiểm với lương cao", () => {
    expect(run({ baseSalary: 60_000_000 })).toMatchObject({ social: 3_744_000, health: 702_000, unemployment: 600_000, taxable: 43_954_000, pit: 7_738_500, net: 47_215_500 });
  });

  it("phụ cấp thâm niên theo % lương hợp đồng", () => {
    expect(run({ baseSalary: 10_000_000, allowances: { seniorityPercent: 5 } }).allowances).toEqual({ seniority: 500_000 });
  });
});
