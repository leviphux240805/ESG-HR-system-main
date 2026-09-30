import type { ComponentType } from "react";
import { matchPath } from "react-router-dom";
import {
  ArrowLeftRight,
  Baby,
  BarChart3,
  CalendarCheck,
  CalendarOff,
  ClipboardCheck,
  Clock,
  FileText,
  FileUp,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  type LucideIcon,
  Receipt,
  School,
  Settings,
  UserCog,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { Action, Resource, RoleCode } from "./permissions";

/** Giai đoạn đang làm theo lộ trình (docs/thiet-ke.md). Mục của giai đoạn sau bị ẩn. */
export const CURRENT_PHASE = 2;

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Giai đoạn làm trang này; lớn hơn CURRENT_PHASE thì ẩn khỏi menu và không có route. */
  phase: number;
  /** Quyền cần có để thấy mục và vào trang; bỏ trống = mọi người đã đăng nhập. */
  permission?: { action: Action; resource: Resource };
  /** Trang đã làm; chưa có thì dùng trang "Sắp có" (chỉ hiện khi bật xem trước ở dev). */
  page?: () => Promise<{ default: ComponentType }>;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const view = (resource: Resource) => ({ action: "view" as const, resource });
const manage = (resource: Resource) => ({ action: "manage" as const, resource });

/** Cấu hình menu duy nhất: Sidebar, router và breadcrumb đều sinh từ đây. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { path: "/", label: "Trang chủ", icon: LayoutDashboard, phase: 1, page: () => import("@/pages/Home") },
      // Trang thử upload/tải file của giai đoạn 1; bỏ khi module Tài liệu (giai đoạn 2) hoàn thành
      { path: "/files-demo", label: "Tệp (thử nghiệm)", icon: FileUp, phase: 1, page: () => import("@/pages/FilesDemo") },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      { path: "/nhan-su", label: "Nhân sự", icon: Users, phase: 2, permission: view("staff"), page: () => import("@/pages/staff/StaffListPage") },
      { path: "/tai-lieu", label: "Tài liệu", icon: FolderOpen, phase: 2, permission: view("documents") },
      { path: "/cong-viec", label: "Công việc", icon: ListTodo, phase: 3, permission: view("tasks") },
      { path: "/cham-cong", label: "Chấm công", icon: CalendarCheck, phase: 3, permission: view("attendance") },
      { path: "/nghi-phep", label: "Nghỉ phép", icon: CalendarOff, phase: 3, permission: view("attendance") },
      { path: "/luong", label: "Lương", icon: Wallet, phase: 4, permission: view("payroll") },
    ],
  },
  {
    label: "Lớp & trẻ",
    items: [
      { path: "/lop-hoc", label: "Lớp học", icon: School, phase: 5, permission: view("classes") },
      { path: "/tre", label: "Hồ sơ trẻ", icon: Baby, phase: 5, permission: view("classes") },
      { path: "/diem-danh", label: "Điểm danh", icon: ClipboardCheck, phase: 5, permission: view("classes") },
      { path: "/thuc-don", label: "Thực đơn", icon: UtensilsCrossed, phase: 7, permission: view("health") },
      { path: "/suc-khoe", label: "Sức khỏe", icon: HeartPulse, phase: 7, permission: view("health") },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { path: "/hoc-phi", label: "Học phí", icon: Receipt, phase: 6, permission: view("finance") },
      { path: "/thu-chi", label: "Thu chi", icon: ArrowLeftRight, phase: 6, permission: view("finance") },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { path: "/bao-cao", label: "Báo cáo", icon: BarChart3, phase: 7, permission: view("reports") },
      // TODO(assumption): màn hình cấu hình và quản lý tài khoản chưa chốt giai đoạn; tạm xếp giai đoạn 2
      { path: "/cai-dat", label: "Cài đặt", icon: Settings, phase: 2, permission: view("settings") },
      { path: "/tai-khoan", label: "Tài khoản", icon: UserCog, phase: 2, permission: manage("settings") },
    ],
  },
  {
    label: "Của tôi",
    items: [
      { path: "/cua-toi/ho-so", label: "Hồ sơ của tôi", icon: UserRound, phase: 2 },
      { path: "/cua-toi/viec", label: "Việc của tôi", icon: ListChecks, phase: 3 },
      { path: "/cua-toi/cham-cong", label: "Chấm công của tôi", icon: Clock, phase: 3 },
      { path: "/cua-toi/phieu-luong", label: "Phiếu lương của tôi", icon: FileText, phase: 4 },
    ],
  },
];

/**
 * Trang con không nằm trên menu (thêm mới, chi tiết). Quyền ở đây chỉ để ẩn/hiện; trang chi tiết tự xử lý 403 từ API
 * (chính chủ xem được hồ sơ của mình dù không có quyền module).
 */
export interface SubRoute {
  path: string;
  label: string;
  /** Mục menu cha (breadcrumb, đánh dấu menu đang chọn). */
  parent: string;
  phase: number;
  permission?: { action: Action; resource: Resource };
  page: () => Promise<{ default: ComponentType }>;
}

export const SUB_ROUTES: SubRoute[] = [
  { path: "/nhan-su/moi", label: "Thêm nhân viên", parent: "/nhan-su", phase: 2, permission: manage("staff"), page: () => import("@/pages/staff/StaffCreatePage") },
  { path: "/nhan-su/:id", label: "Hồ sơ nhân viên", parent: "/nhan-su", phase: 2, permission: view("staff"), page: () => import("@/pages/staff/StaffProfilePage") },
];

/** Xem trước các mục chưa làm (trang "Sắp có") — chỉ ở dev với VITE_PREVIEW_MODULES=true. */
export const PREVIEW_MODULES = import.meta.env.DEV && import.meta.env.VITE_PREVIEW_MODULES === "true";

/** Mục có route: đã tới giai đoạn VÀ đã có trang; hoặc đang xem trước ở dev (trang "Sắp có"). */
export function isAvailable(item: NavItem, phase = CURRENT_PHASE, preview = PREVIEW_MODULES): boolean {
  return (item.phase <= phase && item.page !== undefined) || preview;
}

export type PermissionCheck = (action: Action, resource: Resource) => boolean;

/** Menu hiển thị cho người dùng: đã tới giai đoạn (hoặc xem trước) và đủ quyền; nhóm rỗng bị bỏ. */
export function visibleNavGroups(check: PermissionCheck, phase = CURRENT_PHASE, preview = PREVIEW_MODULES): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        isAvailable(item, phase, preview) &&
        (!item.permission || check(item.permission.action, item.permission.resource)),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Mọi mục có route (dùng để dựng router). */
export function routableNavItems(phase = CURRENT_PHASE, preview = PREVIEW_MODULES): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items).filter((item) => isAvailable(item, phase, preview));
}

/** Trang con có route (đã tới giai đoạn, hoặc xem trước). */
export function routableSubRoutes(phase = CURRENT_PHASE, preview = PREVIEW_MODULES): SubRoute[] {
  return SUB_ROUTES.filter((r) => r.phase <= phase || preview);
}

/**
 * Tìm mục menu theo đường dẫn (breadcrumb). Trang con trả về mục cha kèm nhãn trang con,
 * ví dụ "/nhan-su/123" → Nhân sự › Hồ sơ nhân viên.
 */
export function findNavItem(pathname: string): { group: NavGroup; item: NavItem; subLabel?: string } | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.path === pathname);
    if (item) return { group, item };
  }
  const sub = SUB_ROUTES.find((r) => matchPath(r.path, pathname));
  if (sub) {
    for (const group of NAV_GROUPS) {
      const item = group.items.find((i) => i.path === sub.parent);
      if (item) return { group, item, subLabel: sub.label };
    }
  }
  return null;
}

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
