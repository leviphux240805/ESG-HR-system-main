/** Số ngày từ hôm nay (giờ máy) tới một ngày thuần "yyyy-MM-dd"; âm = đã qua. */
export function daysUntil(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Ngưỡng cảnh báo giấy tờ/hợp đồng sắp hết hạn. */
export const WARNING_DAYS = 30;

/** Hôm nay dạng "yyyy-MM-dd" theo giờ máy. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
