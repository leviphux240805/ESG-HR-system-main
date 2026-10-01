import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";
import { isPrincipal } from "@/lib/permissions";

/** Quyền giao diện thực đơn: sửa thực đơn/món của trường; món dùng chung của tổ chức chỉ hiệu trưởng. */
export function useMenuAccess() {
  const { me } = useAuth();
  return {
    canEdit: useCan("manage", "menu"),
    canShared: isPrincipal(me?.roles ?? []),
  };
}
