import { describe, expect, it } from "vitest";
import { currentMonth, formatDays, isMonth, monthLabel, shiftMonth } from "./codes";

describe("tháng", () => {
  it("cộng trừ tháng qua năm", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });

  it("kiểm tra định dạng và nhãn", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth(null)).toBe(false);
    expect(monthLabel("2026-09")).toBe("Tháng 9/2026");
    expect(currentMonth(new Date(2026, 8, 30))).toBe("2026-09");
  });

  it("số ngày nửa ngày dùng dấu phẩy", () => {
    expect(formatDays(3)).toBe("3");
    expect(formatDays(1.5)).toBe("1,5");
  });
});
