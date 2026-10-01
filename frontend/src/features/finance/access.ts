import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";
import { isPrincipal } from "@/lib/permissions";

/** Quyền giao diện module tài chính: quản lý (kế toán, ban giám hiệu nhóm Tài chính) và danh mục chung (hiệu trưởng). */
export function useFinanceAccess() {
  const { me } = useAuth();
  return {
    canManage: useCan("manage", "finance"),
    canCatalog: isPrincipal(me?.roles ?? []),
  };
}
