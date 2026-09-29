import { FileUp, LayoutDashboard, type LucideIcon } from "lucide-react";
import type { RoleCode } from "@/contexts/AuthContext";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Vai trò được thấy mục này; bỏ trống = mọi vai trò. Chỉ ẩn/hiện menu, quyền thật kiểm tra ở backend. */
  roles?: RoleCode[];
}

/**
 * Menu chính. Trang của các module mới thêm vào đây khi chuyển đổi xong (nhân sự, chấm công… ở giai đoạn 2–7).
 * Trang ESG cũ chưa chuyển đổi không có trong menu.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Trang chủ" },
  // Trang thử upload/tải file qua MinIO của giai đoạn 1; bỏ khi module Tài liệu (giai đoạn 2) hoàn thành
  { to: "/files-demo", icon: FileUp, label: "Tệp (thử nghiệm)" },
];

export const ROLE_LABELS: Record<RoleCode, string> = {
  OWNER: "Chủ chuỗi",
  CHAIN_ADMIN: "Văn phòng điều hành",
  ACCOUNTANT: "Kế toán",
  PRINCIPAL: "Hiệu trưởng",
  TEACHER: "Giáo viên",
  NURSE: "Nhân viên y tế",
  KITCHEN: "Cấp dưỡng",
  STAFF: "Nhân viên",
};
