import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { ListParams } from "@/hooks/useListParams";

type S = components["schemas"];
export type AccountItem = S["AccountItem"];
export type AccountRole = S["AccountRole"];
export type RoleCode = AccountRole["role"];

/** Bộ lọc danh sách tài khoản trên URL. */
export const ACCOUNT_FILTER_KEYS = ["role", "schoolId", "active"] as const;

/** Tài khoản là dữ liệu cả tổ chức: không theo cơ sở đang chọn. */
export function useAccounts(params: ListParams) {
  const { page, size, sort, q, role, schoolId, active } = params.apiParams as Record<string, string | number | undefined>;
  const query = {
    page: page as number,
    size: size as number,
    sort: sort ? [sort as string] : undefined,
    q: q as string | undefined,
    role: role as RoleCode | undefined,
    schoolId: schoolId as string | undefined,
    active: active === undefined ? undefined : active === "true",
  };
  return useQuery({
    queryKey: ["accounts", query],
    queryFn: async () => unwrap(await api.GET("/api/v1/accounts", { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export async function lockAccount(id: string) {
  return unwrap(await api.POST("/api/v1/accounts/{id}/lock", { params: { path: { id } } }));
}

export async function unlockAccount(id: string) {
  return unwrap(await api.POST("/api/v1/accounts/{id}/unlock", { params: { path: { id } } }));
}

/** Đặt mật khẩu mới cho tài khoản; người dùng phải đổi ở lần đăng nhập kế tiếp. */
export async function setAccountPassword(id: string, password: string) {
  return unwrap(await api.POST("/api/v1/accounts/{id}/password", { params: { path: { id } }, body: { password } }));
}

export async function createAccount(body: S["CreateAccountRequest"]) {
  return unwrap(await api.POST("/api/v1/accounts", { body }));
}

export async function updateAccountRoles(id: string, roles: S["RoleAssignment"][]) {
  return unwrap(await api.PUT("/api/v1/accounts/{id}/roles", { params: { path: { id } }, body: { roles } }));
}

/** Tìm nhanh nhân viên để gắn vào tài khoản. */
export function useStaffSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["accounts", "staff-search", q],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/staff", { params: { query: { q, size: 8, status: "ACTIVE" } } })).items,
    enabled,
  });
}
