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

/** Tài khoản là dữ liệu toàn chuỗi: không theo cơ sở đang chọn. */
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
