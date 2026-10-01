import type { FunctionGroup, RoleCode } from "@/lib/permissions";

/** Vai trò hiệu trưởng gán được trên giao diện (PRINCIPAL do bên vận hành gán hoặc tự có khi tạo trường). */
export const ASSIGNABLE_ROLES: RoleCode[] = ["VICE_PRINCIPAL", "ACCOUNTANT", "TEACHER", "NURSE", "KITCHEN", "STAFF"];

export const FUNCTION_GROUP_LABELS: Record<FunctionGroup, string> = {
  CLASSROOM: "Lớp & trẻ",
  NUTRITION: "Thực đơn & sức khỏe",
  HR: "Nhân sự",
  FINANCE: "Tài chính",
  REPORTS: "Báo cáo",
};

/** Dòng vai trò trên form: một vai trò ở một trường; nhóm chức năng chỉ dùng cho phó hiệu trưởng. */
export interface RoleRow {
  role: RoleCode | "";
  schoolId: string;
  functionGroups: FunctionGroup[];
}

export const emptyRoleRow = (): RoleRow => ({ role: "", schoolId: "", functionGroups: [] });

/** Lỗi của từng dòng vai trò (null = hợp lệ); dòng trùng báo ở dòng sau. */
export function roleRowErrors(rows: readonly RoleRow[]): (string | null)[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.role) return "Chọn vai trò";
    if (!row.schoolId) return "Chọn trường cho vai trò này";
    if (row.role === "VICE_PRINCIPAL" && row.functionGroups.length === 0) return "Chọn ít nhất một nhóm chức năng";
    const key = `${row.role}@${row.schoolId}`;
    if (seen.has(key)) return "Trùng với dòng phía trên";
    seen.add(key);
    return null;
  });
}

/** Dòng vai trò → body API (nhóm chức năng chỉ gửi cho phó hiệu trưởng). */
export function toAccountRoles(rows: readonly RoleRow[]) {
  return rows
    .filter((r): r is RoleRow & { role: RoleCode } => !!r.role)
    .map((r) => ({
      role: r.role,
      schoolId: r.schoolId,
      functionGroups: r.role === "VICE_PRINCIPAL" ? r.functionGroups : undefined,
    }));
}
