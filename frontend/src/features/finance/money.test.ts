import { describe, expect, it } from "vitest";
import { monthEnd, monthStart } from "@/api";
import { moneyInput, parseMoney } from "./money";

describe("finance utils", () => {
  it("parses money strings", () => {
    expect(parseMoney("1.500.000")).toBe(1_500_000);
    expect(parseMoney("abc")).toBeNaN();
    expect(moneyInput().safeParse("0").success).toBe(false);
    expect(moneyInput().safeParse("12.000").success).toBe(true);
    expect(moneyInput().safeParse("12a").success).toBe(false);
  });

  it("computes month bounds", () => {
    expect(monthStart("2026-09")).toBe("2026-09-01");
    expect(monthEnd("2026-09")).toBe("2026-09-30");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
  });
});
