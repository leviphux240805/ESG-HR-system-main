import type { ComponentType } from "react";
import { matchPath } from "react-router-dom";
import { Baby, CalendarCheck, CalendarOff, ClipboardCheck, Clock, Inbox, ListTodo, type LucideIcon, School, Sun, Users } from "lucide-react";
import type { Action, Resource, RoleCode } from "./permissions";

/** Giai đoạn đang làm theo lộ trình (docs/thiet-ke.md). Mục của giai đoạn sau bị ẩn. Bản demo: mở mọi mục đã có trang. */
export const CURRENT_PHASE = 9;

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
      { path: "/hom-nay", label: "Hôm nay", icon: Sun, phase: 1, permission: view("approvals"), page: () => import("@/pages/today/TodayPage") },
      { path: "/hop-duyet", label: "Hộp duyệt", icon: Inbox, phase: 1, permission: view("approvals"), page: () => import("@/pages/approvals/ApprovalsPage") },
    ],
  },
  {
    label: "Lớp & trẻ",
    items: [
      // Đầu nhóm: trang mặc định của giáo viên
      { path: "/diem-danh", label: "Điểm danh", icon: ClipboardCheck, phase: 1, permission: view("classes"), page: () => import("@/pages/children/RollCallPage") },
      { path: "/lop-hoc", label: "Lớp học", icon: School, phase: 1, permission: view("classes"), page: () => import("@/pages/classes/ClassesPage") },
      { path: "/tre", label: "Hồ sơ trẻ", icon: Baby, phase: 1, permission: view("classes"), page: () => import("@/pages/children/ChildrenPage") },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      { path: "/nhan-su", label: "Nhân sự", icon: Users, phase: 1, permission: view("staff"), page: () => import("@/pages/staff/StaffListPage") },
      { path: "/cham-cong", label: "Chấm công", icon: CalendarCheck, phase: 1, permission: view("attendance"), page: () => import("@/pages/attendance/AttendancePage") },
      // Mọi người xin nghỉ được; tab "Chờ duyệt", "Lịch nghỉ" hiện theo quyền trong trang
      { path: "/nghi-phep", label: "Nghỉ phép", icon: CalendarOff, phase: 1, page: () => import("@/pages/leave/LeavePage") },
      { path: "/cong-viec", label: "Công việc", icon: ListTodo, phase: 1, permission: view("tasks"), page: () => import("@/pages/tasks/TasksPage") },
    ],
  },
  {
    label: "Của tôi",
    items: [{ path: "/cua-toi/cham-cong", label: "Chấm công của tôi", icon: Clock, phase: 1, page: () => import("@/pages/me/MyAttendancePage") }],
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
  { path: "/tre/:id", label: "Chi tiết", parent: "/tre", phase: 1, permission: view("classes"), page: () => import("@/pages/children/ChildProfilePage") },
  { path: "/nhan-su/moi", label: "Thêm nhân viên", parent: "/nhan-su", phase: 1, permission: manage("staff"), page: () => import("@/pages/staff/StaffCreatePage") },
  { path: "/nhan-su/de-xuat", label: "Đề xuất cập nhật hồ sơ", parent: "/nhan-su", phase: 1, permission: view("staff"), page: () => import("@/pages/staff/ChangeRequestsPage") },
  { path: "/nhan-su/giay-to-het-han", label: "Giấy tờ sắp hết hạn", parent: "/nhan-su", phase: 1, permission: view("staff"), page: () => import("@/pages/staff/StaffExpiringPage") },
  // Đặt sau các đường dẫn cố định: tìm breadcrumb duyệt theo thứ tự
  { path: "/nhan-su/:id", label: "Hồ sơ nhân viên", parent: "/nhan-su", phase: 1, permission: view("staff"), page: () => import("@/pages/staff/StaffProfilePage") },
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
  VICE_PRINCIPAL: "Phó hiệu trưởng",
  TEACHER: "Giáo viên",
  NURSE: "Nhân viên y tế",
  KITCHEN: "Cấp dưỡng",
  STAFF: "Nhân viên",
};
