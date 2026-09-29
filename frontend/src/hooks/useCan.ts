import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { type Action, type Resource, can, rolesInScope } from "@/lib/permissions";

/**
 * Kiểm tra quyền phía giao diện theo vai trò áp dụng cho cơ sở đang chọn. Chỉ để ẩn/hiện; backend vẫn kiểm tra.
 *
 *   const canManage = useCan("manage", "staff");
 */
export function useCan(action: Action, resource: Resource): boolean {
  const check = usePermissions();
  return check(action, resource);
}

/** Dạng hàm, dùng khi cần kiểm nhiều quyền trong một component (menu, cột bảng). */
export function usePermissions() {
  const { me, selectedSchoolId } = useAuth();
  const roles = useMemo(() => rolesInScope(me?.roles ?? [], selectedSchoolId), [me, selectedSchoolId]);
  return useCallback((action: Action, resource: Resource) => can(roles, action, resource), [roles]);
}
