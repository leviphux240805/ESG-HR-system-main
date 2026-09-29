import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Nhãn và màu cho các trạng thái dùng chung giữa các module (cột trạng thái varchar + CHECK ở backend).
 * Module có trạng thái riêng truyền thêm `labels` khi dùng StatusBadge.
 */
export const COMMON_STATUSES: Record<string, StatusMeta> = {
  DRAFT: { label: "Nháp", tone: "neutral" },
  PENDING: { label: "Chờ xử lý", tone: "warning" },
  READY: { label: "Sẵn sàng", tone: "success" },
  NEW: { label: "Mới", tone: "info" },
  IN_PROGRESS: { label: "Đang làm", tone: "info" },
  WAITING_APPROVAL: { label: "Chờ duyệt", tone: "warning" },
  APPROVED: { label: "Đã duyệt", tone: "success" },
  REJECTED: { label: "Từ chối", tone: "danger" },
  DONE: { label: "Hoàn thành", tone: "success" },
  ISSUED: { label: "Đã phát hành", tone: "info" },
  PARTIAL: { label: "Thanh toán một phần", tone: "warning" },
  PAID: { label: "Đã thanh toán", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  INACTIVE: { label: "Ngừng hoạt động", tone: "neutral" },
  LOCKED: { label: "Đã khóa", tone: "neutral" },
};

interface StatusBadgeProps {
  status: string;
  /** Nhãn/màu riêng của module, ưu tiên hơn bảng chung. */
  labels?: Record<string, StatusMeta>;
  className?: string;
}

/** Nhãn trạng thái có màu. Trạng thái lạ hiện nguyên mã với màu trung tính (không làm vỡ giao diện). */
export function StatusBadge({ status, labels, className }: StatusBadgeProps) {
  const meta = labels?.[status] ?? COMMON_STATUSES[status] ?? { label: status, tone: "neutral" as const };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
