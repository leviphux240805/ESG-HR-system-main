/**
 * Định dạng hiển thị thống nhất cho toàn app (tiếng Việt, giờ Việt Nam).
 * - Tiền: "1.500.000 ₫" (khoảng trắng không ngắt trước ₫ để không xuống dòng giữa số và đơn vị)
 * - Ngày: dd/MM/yyyy · Giờ: HH:mm · Tháng: "Tháng 9/2026"
 * Giá trị rỗng/không hợp lệ trả về chuỗi rỗng.
 */

const TIME_ZONE = "Asia/Ho_Chi_Minh";

const moneyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const monthPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "numeric",
  year: "numeric",
});

type DateInput = string | Date | null | undefined;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

/** Tiền (đồng): 1500000 → "1.500.000 ₫". Nhận cả chuỗi số từ API (numeric). */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? moneyFormat.format(amount) : "";
}

function toInstant(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Ngày dd/MM/yyyy. Ngày thuần (LocalDate "2026-09-29") được cắt chuỗi trực tiếp, không qua Date để không lệch
 * múi giờ; thời điểm (ISO có giờ) hiển thị theo giờ Việt Nam.
 */
export function formatDate(value: DateInput): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = LOCAL_DATE.exec(value);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const date = toInstant(value);
  return date ? dateFormat.format(date) : "";
}

/** Giờ HH:mm. Nhận giờ thuần (LocalTime "07:30:00") hoặc thời điểm (hiển thị theo giờ Việt Nam). */
export function formatTime(value: DateInput): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = LOCAL_TIME.exec(value);
    if (m) return `${m[1]}:${m[2]}`;
  }
  const date = toInstant(value);
  return date ? timeFormat.format(date) : "";
}

/** Ngày giờ "dd/MM/yyyy HH:mm" của một thời điểm. */
export function formatDateTime(value: DateInput): string {
  const date = formatDate(value);
  const time = formatTime(value);
  return date && time ? `${date} ${time}` : date;
}

/** Tháng "Tháng 9/2026". Nhận "2026-09", ngày thuần, thời điểm hoặc Date. */
export function formatMonth(value: DateInput): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = YEAR_MONTH.exec(value) ?? LOCAL_DATE.exec(value);
    if (m) return `Tháng ${Number(m[2])}/${m[1]}`;
  }
  const date = toInstant(value);
  if (!date) return "";
  const parts = monthPartsFormat.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  return `Tháng ${month}/${year}`;
}
