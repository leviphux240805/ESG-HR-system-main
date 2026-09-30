import { describe, expect, it } from "vitest";
import { formatAge } from "./age";

describe("formatAge", () => {
  const at = new Date(2026, 8, 30);
  it("dưới 3 tuổi tính theo tháng", () => {
    expect(formatAge("2024-03-15", at)).toBe("30 tháng");
    expect(formatAge("2024-10-01", at)).toBe("23 tháng");
  });
  it("từ 3 tuổi: tuổi và tháng", () => {
    expect(formatAge("2022-05-30", at)).toBe("4 tuổi 4 tháng");
    expect(formatAge("2021-09-30", at)).toBe("5 tuổi");
  });
});
