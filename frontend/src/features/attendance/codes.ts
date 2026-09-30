/** Bộ mã công ESG (backend kiểm tra lại, xem AttendanceReconciler.CODES). */
export const ATTENDANCE_CODES = ["X", "P", "1/2P", "K", "1/2K", "O", "CO", "TS", "T", "NL", "NB", "NN"] as const;
export type AttendanceCode = (typeof ATTENDANCE_CODES)[number];

export const CODE_LABELS: Record<AttendanceCode, string> = {
  X: "Đủ công",
  P: "Nghỉ phép",
  "1/2P": "Nghỉ nửa ngày tính phép",
  K: "Nghỉ không lương",
  "1/2K": "Nghỉ nửa ngày không lương",
  O: "Ốm, điều dưỡng",
  CO: "Con ốm",
  TS: "Thai sản",
  T: "Tai nạn",
  NL: "Ngày lễ",
  NB: "Nghỉ bù",
  NN: "Làm nửa ngày công",
};

/** Màu chữ theo nhóm mã (nền do ngày nghỉ tuần/ngày lễ quyết định). */
export function codeTone(code: string | null | undefined): string {
  switch (code) {
    case "X":
      return "text-foreground";
    case "P":
    case "1/2P":
    case "NB":
      return "text-blue-700";
    case "K":
    case "1/2K":
      return "text-red-700";
    case "O":
    case "CO":
    case "TS":
    case "T":
      return "text-amber-700";
    case "NL":
      return "text-red-600";
    case "NN":
      return "text-purple-700";
    default:
      return "text-muted-foreground";
  }
}

export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Tháng "yyyy-MM" của hôm nay (giờ máy). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Cộng/trừ tháng trên chuỗi "yyyy-MM". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonth(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-09" → "Tháng 9/2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `Tháng ${m}/${y}`;
}

/** Số tổng dạng "1,5" (bỏ số 0 thừa). */
export function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}
