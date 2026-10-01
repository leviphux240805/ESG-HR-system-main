import type { components } from "@/api/schema";

/**
 * Ma trận quyền phía giao diện, chép từ docs/thiet-ke.md (mục "Vai trò và phân quyền").
 * CHỈ dùng để ẩn/hiện menu, nút, cột. Backend mới là nơi quyết định quyền; đổi quyền thì sửa backend trước,
 * rồi cập nhật bảng này cho khớp.
 */

type Grant = components["schemas"]["RoleGrant"];
export type RoleCode = Grant["role"];
export type FunctionGroup = Grant["functionGroups"][number];

/** Module trong ma trận quyền. */
export type Resource =
  | "settings" // Trường, tài khoản, cấu hình
  | "staff" // Nhân sự
  | "documents" // Tài liệu
  | "tasks" // Công việc
  | "attendance" // Chấm công & nghỉ phép
  | "classes" // Lớp học, hồ sơ trẻ, điểm danh
  | "menu" // Thực đơn
  | "health" // Sức khỏe trẻ (cân đo, sổ theo dõi)
  | "finance" // Học phí & thu chi
  | "payroll" // Lương & phiếu lương
  | "reports" // Báo cáo & dashboard
  | "today" // Hôm nay: lớp, trẻ vắng, dạy thay (ban giám hiệu quản lý lớp)
  | "approvals"; // Hộp duyệt (ban giám hiệu)

export type Action = "view" | "manage" | "approve" | "export";

/**
 * Mức truy cập trong thiết kế: SCHOOL = đọc/ghi ở trường được gán · GROUP = như SCHOOL nếu được giao nhóm chức năng
 * của module (phó hiệu trưởng) · VIEW = chỉ đọc · CLASS = lớp được phân công · SELF = dữ liệu của bản thân (nằm ở
 * nhóm "Của tôi") · NONE = không truy cập.
 */
export type AccessLevel = "SCHOOL" | "GROUP" | "VIEW" | "CLASS" | "SELF" | "NONE";

type Row = Record<RoleCode, AccessLevel>;

export const PERMISSION_MATRIX: Record<Resource, Row> = {
  settings: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "NONE", ACCOUNTANT: "NONE", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  // Kế toán: xem (lương, ngân hàng)
  staff: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "VIEW", TEACHER: "SELF", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // Nhân viên: xem + xác nhận đã đọc
  documents: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "SCHOOL", TEACHER: "VIEW", NURSE: "VIEW", KITCHEN: "VIEW", STAFF: "VIEW" },
  // Giáo viên: xem việc được giao
  tasks: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "SELF", TEACHER: "VIEW", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  attendance: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "VIEW", TEACHER: "SELF", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // Cấp dưỡng: xem (sĩ số)
  classes: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "VIEW", TEACHER: "CLASS", NURSE: "VIEW", KITCHEN: "VIEW", STAFF: "NONE" },
  // Module "Thực đơn & sức khỏe" tách hai phần: cấp dưỡng sửa thực đơn nhưng không xem sức khỏe; giáo viên xem
  // thực đơn, cân đo và ghi sổ theo dõi lớp mình
  menu: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "NONE", TEACHER: "VIEW", NURSE: "SCHOOL", KITCHEN: "SCHOOL", STAFF: "NONE" },
  health: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "NONE", TEACHER: "CLASS", NURSE: "SCHOOL", KITCHEN: "NONE", STAFF: "NONE" },
  finance: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "SCHOOL", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  // Còn lại: phiếu lương của mình
  payroll: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "SCHOOL", TEACHER: "SELF", NURSE: "SELF", KITCHEN: "SELF", STAFF: "SELF" },
  // Kế toán: báo cáo tài chính
  reports: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "VIEW", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  today: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "NONE", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
  approvals: { PRINCIPAL: "SCHOOL", VICE_PRINCIPAL: "GROUP", ACCOUNTANT: "NONE", TEACHER: "NONE", NURSE: "NONE", KITCHEN: "NONE", STAFF: "NONE" },
};

/** Nhóm chức năng của phó hiệu trưởng mở module; "ANY" = mọi nhóm (Hôm nay, Hộp duyệt theo nhóm được giao). */
export const RESOURCE_GROUP: Record<Resource, FunctionGroup | "ANY" | null> = {
  settings: null,
  staff: "HR",
  documents: "HR",
  tasks: "HR",
  attendance: "HR",
  classes: "CLASSROOM",
  menu: "NUTRITION",
  health: "NUTRITION",
  finance: "FINANCE",
  payroll: "FINANCE",
  reports: "REPORTS",
  today: "CLASSROOM",
  approvals: "ANY",
};

/** Ai được bấm "Duyệt" theo module (thiết kế ghi rõ người duyệt); module khác: ai quản lý được thì duyệt được. */
const APPROVERS: Partial<Record<Resource, RoleCode[]>> = {
  payroll: ["PRINCIPAL"],
  attendance: ["PRINCIPAL", "VICE_PRINCIPAL"],
  tasks: ["PRINCIPAL", "VICE_PRINCIPAL"],
};

const VIEW_LEVELS: AccessLevel[] = ["SCHOOL", "VIEW", "CLASS"];
const MANAGE_LEVELS: AccessLevel[] = ["SCHOOL", "CLASS"];

/** Vai trò kèm nhóm chức năng (chỉ phó hiệu trưởng có nhóm). */
export interface ScopedRole {
  role: RoleCode;
  groups?: readonly FunctionGroup[];
}

const scoped = (r: RoleCode | ScopedRole): ScopedRole => (typeof r === "string" ? { role: r } : r);

/** Mức truy cập thực tế: mức GROUP thành SCHOOL nếu được giao nhóm của module, ngược lại NONE. */
export function accessLevel(r: RoleCode | ScopedRole, resource: Resource): AccessLevel {
  const { role, groups = [] } = scoped(r);
  const level = PERMISSION_MATRIX[resource][role];
  if (level !== "GROUP") return level;
  const group = RESOURCE_GROUP[resource];
  const allowed = group === "ANY" ? groups.length > 0 : group !== null && groups.includes(group);
  return allowed ? "SCHOOL" : "NONE";
}

/**
 * Có ít nhất một vai trò cho phép `action` trên `resource`. Mức SELF không mở trang quản lý của module
 * (dữ liệu của mình nằm ở nhóm "Của tôi").
 */
export function can(roles: readonly (RoleCode | ScopedRole)[], action: Action, resource: Resource): boolean {
  return roles.some((r) => {
    const level = accessLevel(r, resource);
    switch (action) {
      case "view":
      case "export":
        return VIEW_LEVELS.includes(level);
      case "manage":
        return MANAGE_LEVELS.includes(level);
      case "approve": {
        const approvers = APPROVERS[resource];
        return MANAGE_LEVELS.includes(level) && (!approvers || approvers.includes(scoped(r).role));
      }
    }
  });
}

interface RoleGrant {
  role: RoleCode;
  schoolId: string;
  functionGroups?: readonly FunctionGroup[];
}

/**
 * Vai trò áp dụng cho phạm vi đang chọn: vai trò ở đúng trường đang chọn, hoặc mọi vai trò khi xem "Tất cả trường".
 * Cùng một vai trò ở nhiều trường thì gộp nhóm chức năng.
 */
export function rolesInScope(grants: readonly RoleGrant[], selectedSchoolId: string | null): ScopedRole[] {
  const byRole = new Map<RoleCode, Set<FunctionGroup>>();
  for (const g of grants) {
    if (selectedSchoolId !== null && g.schoolId !== selectedSchoolId) continue;
    const groups = byRole.get(g.role) ?? new Set<FunctionGroup>();
    (g.functionGroups ?? []).forEach((f) => groups.add(f));
    byRole.set(g.role, groups);
  }
  return [...byRole.entries()].map(([role, groups]) => (groups.size ? { role, groups: [...groups] } : { role }));
}

/** Hiệu trưởng ở ít nhất một trường: sửa dữ liệu dùng chung của tổ chức (danh mục, món chung, văn bản chung). */
export const isPrincipal = (grants: readonly { role: RoleCode }[]) => grants.some((g) => g.role === "PRINCIPAL");
