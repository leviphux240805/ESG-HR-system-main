import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/useCan";
import type { Action, Resource } from "@/lib/permissions";
import Forbidden from "@/pages/Forbidden";

export function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Đang tải...
    </div>
  );
}

export const CHANGE_PASSWORD_PATH = "/doi-mat-khau";

/**
 * Chưa đăng nhập → /login (nhớ trang đang mở để quay lại sau khi đăng nhập). Đang dùng mật khẩu do người khác đặt →
 * trang đổi mật khẩu (backend cũng chặn mọi API khác).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
  if (me?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  return <>{children}</>;
}

/**
 * Không đủ quyền (theo vai trò ở cơ sở đang chọn) → trang 403 thân thiện. Chỉ là lớp giao diện; API vẫn kiểm tra
 * quyền ở backend.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission?: { action: Action; resource: Resource };
  children: ReactNode;
}) {
  const check = usePermissions();
  if (permission && !check(permission.action, permission.resource)) return <Forbidden />;
  return <>{children}</>;
}
