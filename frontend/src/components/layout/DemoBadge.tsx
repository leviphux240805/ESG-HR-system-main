import { IS_DEMO } from "@/api";

/** Nhãn nhắc người xem đây là bản demo chạy bằng dữ liệu mẫu, không phải dữ liệu thật của trường. */
export function DemoBadge() {
  if (!IS_DEMO) return null;
  return (
    <span
      className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300"
      title="Bản demo: dữ liệu là dữ liệu mẫu, thay đổi chỉ lưu trên trình duyệt này"
    >
      Demo
    </span>
  );
}
