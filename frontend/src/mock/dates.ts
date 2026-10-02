import { peekDb } from "./db";

/** Ngày dạng "yyyy-MM-dd" theo giờ máy (mock không dùng UTC để "hôm nay" khớp người xem). */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** 1 = thứ Hai … 7 = Chủ nhật */
export function weekday(date: string): number {
  const w = parse(date).getDay();
  return w === 0 ? 7 : w;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function shiftMonthStr(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Thứ Hai của tuần chứa `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - weekday(date));
}

export function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const HOLIDAYS: Record<string, string> = {
  "01-01": "Tết Dương lịch",
  "04-30": "Ngày Giải phóng miền Nam",
  "05-01": "Quốc tế Lao động",
  "09-01": "Quốc khánh",
  "09-02": "Quốc khánh",
};

/** Ngày lễ quốc gia cố định (mm-dd → tên). */
export function nationalHoliday(date: string): string | undefined {
  return HOLIDAYS[date.slice(5)];
}

/** Tên ngày lễ: quốc gia hoặc ngày lễ thêm trong bản demo (chung, hoặc riêng trường `schoolId`). */
export function holidayName(date: string, schoolId?: string): string | undefined {
  return (
    nationalHoliday(date) ??
    peekDb()?.customHolidays?.find((h) => h.date === date && (!h.schoolId || h.schoolId === schoolId))?.name
  );
}

/** Ngày trẻ đi học: thứ Hai–thứ Sáu, trừ ngày lễ. */
export function isSchoolDay(date: string): boolean {
  return weekday(date) <= 5 && !holidayName(date);
}

/** Ngày làm việc của nhân viên: thứ Hai–thứ Bảy (thứ Bảy nửa buổi), trừ ngày lễ. */
export function isWorkDay(date: string): boolean {
  return weekday(date) <= 6 && !holidayName(date);
}

export function lastSchoolDay(date: string): string {
  let d = date;
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return d;
}

/** Số tháng tuổi tại ngày `at`. */
export function ageMonths(dob: string, at: string): number {
  const a = parse(dob);
  const b = parse(at);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return months;
}
