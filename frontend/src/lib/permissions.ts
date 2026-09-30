import type { components } from "@/api/schema";

/**
 * Ma trận quyền phía giao diện, chép từ docs/thiet-ke.md (mục "Vai trò và phân quyền").
 * CHỈ dùng để ẩn/hiện menu, nút, cột. Backend mới là nơi quyết định quyền; đổi quyền thì sửa backend trước,
 * rồi cập nhật bảng này cho khớp.
 */

// VICE_PRINCIPAL: vai trò mới của ban giám hiệu (bản demo), backend chưa có
export type RoleCode = components["schemas"]["RoleGrant"]["role"] | "VICE_PRINCIPAL";

/** Module trong ma trận quyền. */
export type Resource =
  | "settings" // Cơ sở, tài khoản, cấu hình
  | "staff" // Nhân sự
  | "documents" // Tài liệu
  | "tasks" // Công việc
  | "attendance" // Chấm công & nghỉ phép
  | "classes" // Lớp học, hồ sơ trẻ, điểm danh
  | "health" // Thực đơn & sức khỏe
  | "finance" // Học phí & thu chi
  | "payroll" // Lương & phiếu lương
  | "reports" // Báo cáo & dashboard
  | "approvals"; // Hôm nay, Hộp duyệt (ban giám hiệu)

export type Action = "view" | "manage" | "approve" | "export";

/**
 * Mức truy cập trong thiết kế: CHAIN = đọc/ghi mọi cơ sở · SCHOOL = đọc/ghi trong phạm vi · VIEW = chỉ đọc ·
 * CLASS = lớp được phân công · SELF = dữ liệu của bản thân (nằm ở nhóm "Của tôi") · NONE = không truy cập.
 */
export type AccessLevel = "CHAIN" | "SCHOOL" | "VIEW" | "CLASS" | "SELF" | "NONE";

type Row = Record<RoleCode, AccessLevel>;

export const PERMISSION_MATRIX: Record<Resource, Row> = {
  settings: { OWNER: "CHAIN", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "VIEW", PRINCIPAL: "VIEW", VICE_PRINCIPAL: "VIEW", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  // Kế toán: xem (lương, ngân hàng) · Hiệu trưởng: cơ sở, trừ cấu hình lương · Phó hiệu trưởng: xem
  staff: { OWNER: "CHAIN", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "VIEW", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "VIEW", TEACHER: "SELF", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // Nhân viên: xem + xác nhận đã đọc
  documents: { OWNER: "CHAIN", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "SCHOOL", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "VIEW", NURSE: "VIEW", KITCHEN: "VIEW", STAFF: "VIEW" },
  // BGH: cơ sở (giao việc) · Giáo viên (demo): xem việc được giao
  tasks: { OWNER: "CHAIN", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "SELF", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "VIEW", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // BGH: cơ sở (duyệt nghỉ) · nhân viên: của mình (xin nghỉ)
  attendance: { OWNER: "VIEW", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "VIEW", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "SELF", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // Cấp dưỡng: xem (sĩ số)
  classes: { OWNER: "VIEW", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "VIEW", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "CLASS", NURSE: "VIEW", KITCHEN: "VIEW", STAFF: "NONE" },
  // Giáo viên: lớp (cân đo, sổ theo dõi) · Cấp dưỡng: cơ sở (thực đơn)
  health: { OWNER: "VIEW", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "NONE", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "CLASS", NURSE: "SCHOOL", KITCHEN: "SCHOOL", STAFF: "NONE" },
  // Bản demo: hiệu trưởng ghi nhận thu tiền
  finance: { OWNER: "VIEW", CHAIN_ADMIN: "VIEW", ACCOUNTANT: "SCHOOL", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "VIEW", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  // Chủ chuỗi: chuỗi (duyệt) · còn lại: phiếu lương của mình
  payroll: { OWNER: "CHAIN", CHAIN_ADMIN: "VIEW", ACCOUNTANT: "SCHOOL", PRINCIPAL: "SELF", VICE_PRINCIPAL: "SELF", TEACHER: "SELF", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // Kế toán: báo cáo tài chính
  reports: { OWNER: "CHAIN", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "VIEW", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  approvals: { OWNER: "CHAIN", CHAIN_ADMIN: "CHAIN", ACCOUNTANT: "NONE", PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "SCHOOL", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
};

/** Ai được bấm "Duyệt" theo module (thiết kế ghi rõ người duyệt); module khác: ai quản lý được thì duyệt được. */
const APPROVERS: Partial<Record<Resource, RoleCode[]>> = {
  payroll: ["OWNER"],
  attendance: ["PRINCIPAL", "VICE_PRINCIPAL", "CHAIN_ADMIN"],
  tasks: ["OWNER", "CHAIN_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"],
};

const VIEW_LEVELS: AccessLevel[] = ["CHAIN", "SCHOOL", "VIEW", "CLASS"];
const MANAGE_LEVELS: AccessLevel[] = ["CHAIN", "SCHOOL", "CLASS"];

export function accessLevel(role: RoleCode, resource: Resource): AccessLevel {
  return PERMISSION_MATRIX[resource][role];
}

/**
 * Có ít nhất một vai trò cho phép `action` trên `resource`. Mức SELF không mở trang quản lý của module
 * (dữ liệu của mình nằm ở nhóm "Của tôi").
 */
export function can(roles: readonly RoleCode[], action: Action, resource: Resource): boolean {
  return roles.some((role) => {
    const level = accessLevel(role, resource);
    switch (action) {
      case "view":
      case "export":
        return VIEW_LEVELS.includes(level);
      case "manage":
        return MANAGE_LEVELS.includes(level);
      case "approve": {
        const approvers = APPROVERS[resource];
        return approvers ? approvers.includes(role) : MANAGE_LEVELS.includes(level);
      }
    }
  });
}

interface RoleGrant {
  role: RoleCode;
  schoolId?: string;
}

/**
 * Vai trò áp dụng cho phạm vi đang chọn: vai trò cấp chuỗi luôn áp dụng; vai trò cấp cơ sở chỉ áp dụng khi đang
 * chọn đúng cơ sở đó (hoặc đang xem "Tất cả cơ sở").
 */
export function rolesInScope(grants: readonly RoleGrant[], selectedSchoolId: string | null): RoleCode[] {
  const roles = grants
    .filter((g) => !g.schoolId || selectedSchoolId === null || g.schoolId === selectedSchoolId)
    .map((g) => g.role);
  return [...new Set(roles)];
}
