import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatMonth, formatTime } from "./format";

// Intl dùng khoảng trắng không ngắt (U+00A0) trước ký hiệu ₫
const NBSP = " ";

describe("formatMoney", () => {
  it("định dạng đồng Việt Nam", () => {
    expect(formatMoney(1500000)).toBe(`1.500.000${NBSP}₫`);
    expect(formatMoney(0)).toBe(`0${NBSP}₫`);
    expect(formatMoney(-250000)).toBe(`-250.000${NBSP}₫`);
  });

  it("nhận chuỗi số từ API và bỏ qua giá trị rỗng", () => {
    expect(formatMoney("1500000")).toBe(`1.500.000${NBSP}₫`);
    expect(formatMoney(null)).toBe("");
    expect(formatMoney(undefined)).toBe("");
    expect(formatMoney("abc")).toBe("");
  });

  it("làm tròn về đồng", () => {
    expect(formatMoney(1234.6)).toBe(`1.235${NBSP}₫`);
  });
});

describe("formatDate", () => {
  it("ngày thuần không bị lệch múi giờ", () => {
    expect(formatDate("2026-09-01")).toBe("01/09/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });

  it("thời điểm hiển thị theo giờ Việt Nam", () => {
    // 20:30 UTC ngày 30/9 = 03:30 ngày 1/10 giờ Việt Nam
    expect(formatDate("2026-09-30T20:30:00Z")).toBe("01/10/2026");
    expect(formatDate(new Date("2026-09-29T00:00:00Z"))).toBe("29/09/2026");
  });

  it("giá trị rỗng hoặc sai trả chuỗi rỗng", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("khong-phai-ngay")).toBe("");
  });
});

describe("formatTime / formatDateTime", () => {
  it("giờ thuần và thời điểm", () => {
    expect(formatTime("07:05:00")).toBe("07:05");
    expect(formatTime("2026-09-29T01:05:00Z")).toBe("08:05");
    expect(formatTime("2026-09-29T15:45:00Z")).toBe("22:45");
  });

  it("ngày giờ", () => {
    expect(formatDateTime("2026-09-29T01:05:00Z")).toBe("29/09/2026 08:05");
  });
});

describe("formatMonth", () => {
  it("các dạng đầu vào", () => {
    expect(formatMonth("2026-09")).toBe("Tháng 9/2026");
    expect(formatMonth("2026-12-01")).toBe("Tháng 12/2026");
    expect(formatMonth("2026-09-30T20:30:00Z")).toBe("Tháng 10/2026");
    expect(formatMonth(null)).toBe("");
  });
});
