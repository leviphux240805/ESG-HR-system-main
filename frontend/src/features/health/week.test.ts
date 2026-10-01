import { describe, expect, it } from "vitest";
import { addDays, mondayOf, weekDays, weekRangeLabel, weekdayLabel } from "./week";

describe("week helpers", () => {
  it("chuẩn hóa về thứ Hai, kể cả Chủ nhật và qua tháng", () => {
    expect(mondayOf("2026-10-01")).toBe("2026-09-28");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("cộng ngày và liệt kê ngày trong tuần", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(weekDays("2026-09-28")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(weekDays("2026-09-28", 6)).toHaveLength(6);
  });

  it("nhãn tuần và thứ", () => {
    expect(weekRangeLabel("2026-09-28")).toBe("28/09 – 04/10/2026");
    expect(weekdayLabel("2026-09-28")).toBe("Thứ Hai");
    expect(weekdayLabel("2026-10-04")).toBe("Chủ nhật");
  });
});
