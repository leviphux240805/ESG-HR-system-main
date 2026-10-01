import { api, setAccessToken, unwrap } from "@/api/client";
import { IS_DEMO } from "@/api/source";
import type { components } from "@/api/schema";

type S = components["schemas"];
export type TokenResponse = S["TokenResponse"];

/** Đăng nhập bằng email hoặc số điện thoại; access token giữ trong bộ nhớ, refresh token nằm ở cookie httpOnly. */
export async function login(identifier: string, password: string, rememberMe: boolean) {
  const tokens = unwrap(await api.POST("/api/v1/auth/login", { body: { identifier, password, rememberMe } }));
  setAccessToken(tokens.accessToken);
  return tokens;
}

export async function logout() {
  if (!IS_DEMO) await api.POST("/api/v1/auth/logout");
}

/** Tự đổi mật khẩu; backend đăng xuất các phiên khác và cấp token mới cho phiên này. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const tokens = unwrap(await api.POST("/api/v1/auth/change-password", { body: { currentPassword, newPassword } }));
  setAccessToken(tokens.accessToken);
  return tokens;
}

export async function forgotPassword(identifier: string) {
  return unwrap(await api.POST("/api/v1/auth/forgot-password", { body: { identifier: identifier.trim() } }));
}

export async function resetPassword(token: string, newPassword: string) {
  return unwrap(await api.POST("/api/v1/auth/reset-password", { body: { token, newPassword } }));
}

// ------------------------------------------------------------ phiên bản demo

/** Vai trò chọn khi đăng nhập bản demo. */
export type DemoRole = "principal" | "vice" | "teacher";

/** Vai trò đang chọn của bản demo; null nếu chưa đăng nhập. Bản thật luôn trả null. */
export async function demoRole(): Promise<DemoRole | null> {
  if (!IS_DEMO) return null;
  return (await import("@/mock")).getSessionRole();
}

export async function setDemoRole(role: DemoRole | null) {
  if (IS_DEMO) (await import("@/mock")).setSessionRole(role);
}

/** Xóa mọi thay đổi trên bản demo và sinh lại dữ liệu mẫu. */
export async function resetDemoData() {
  if (IS_DEMO) (await import("@/mock")).resetDb();
}
