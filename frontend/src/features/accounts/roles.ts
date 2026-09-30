import type { RoleCode } from "./api";

/** Phạm vi gán vai trò (khớp RoleCode.Scope ở backend và CHECK user_roles_scope). */
export const ROLE_SCOPE: Record<RoleCode, "CHAIN" | "SCHOOL" | "CHAIN_OR_SCHOOL"> = {
  OWNER: "CHAIN",
  CHAIN_ADMIN: "CHAIN",
  ACCOUNTANT: "CHAIN_OR_SCHOOL",
  PRINCIPAL: "SCHOOL",
  TEACHER: "SCHOOL",
  NURSE: "SCHOOL",
  KITCHEN: "SCHOOL",
  STAFF: "SCHOOL",
};

/** Dòng vai trò trên form: schoolId "" = toàn chuỗi. */
export interface RoleRow {
  role: RoleCode | "";
  schoolId: string;
}

/** Lỗi của từng dòng vai trò (null = hợp lệ); dòng trùng báo ở dòng sau. */
export function roleRowErrors(rows: readonly RoleRow[]): (string | null)[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.role) return "Chọn vai trò";
    const scope = ROLE_SCOPE[row.role];
    if (scope === "SCHOOL" && !row.schoolId) return "Chọn cơ sở cho vai trò này";
    if (scope === "CHAIN" && row.schoolId) return "Vai trò này chỉ gán toàn chuỗi";
    const key = `${row.role}@${row.schoolId}`;
    if (seen.has(key)) return "Trùng với dòng phía trên";
    seen.add(key);
    return null;
  });
}

/** Dòng vai trò → body API (bỏ trống schoolId khi toàn chuỗi). */
export function toAccountRoles(rows: readonly RoleRow[]) {
  return rows
    .filter((r): r is RoleRow & { role: RoleCode } => !!r.role)
    .map((r) => ({ role: r.role, schoolId: r.schoolId || undefined }));
}
