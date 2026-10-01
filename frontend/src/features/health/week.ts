import { useSearchParams } from "react-router-dom";

const pad = (n: number) => String(n).padStart(2, "0");

/** Ngày "yyyy-MM-dd" theo giờ máy. */
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayIso = () => isoDate(new Date());

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

/** Thứ Hai của tuần chứa `date`. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** `count` ngày liên tiếp từ thứ Hai `weekStart`. */
export const weekDays = (weekStart: string, count = 5) => Array.from({ length: count }, (_, i) => addDays(weekStart, i));

const WEEKDAY_LABELS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function weekdayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
}

/** "28/09 – 04/10/2026" */
export function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const [, sm, sd] = weekStart.split("-");
  const [ey, em, ed] = end.split("-");
  return `${sd}/${sm} – ${ed}/${em}/${ey}`;
}

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Tuần đang xem lấy từ `?week=` (luôn chuẩn hóa về thứ Hai; mặc định tuần hiện tại). */
export function useWeekParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("week");
  const week = mondayOf(isDate(raw) ? raw : todayIso());
  const setWeek = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("week", mondayOf(value));
    setSearchParams(next, { replace: true });
  };
  return [week, setWeek] as const;
}
