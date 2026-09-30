import { describe, expect, it } from "vitest";
import { leaveRange } from "./leave";

describe("leaveRange", () => {
  it("một ngày, khoảng trong năm, khoảng qua năm", () => {
    expect(leaveRange("2026-11-02", "2026-11-02")).toBe("02/11/2026");
    expect(leaveRange("2026-11-02", "2026-11-04")).toBe("02/11 – 04/11/2026");
    expect(leaveRange("2026-12-30", "2027-01-02")).toBe("30/12/2026 – 02/01/2027");
  });
});
