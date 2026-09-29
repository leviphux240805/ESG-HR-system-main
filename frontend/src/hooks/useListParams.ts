import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type SortDirection = "asc" | "desc";

export interface ListSort {
  field: string;
  direction: SortDirection;
}

interface ListParamsOptions {
  /** Tên các bộ lọc của trang (khóa trên URL), ví dụ ["status", "from", "to"]. */
  filterKeys?: readonly string[];
  defaultSize?: number;
  defaultSort?: ListSort;
}

export const PAGE_SIZES = [10, 20, 50, 100] as const;

function parseSort(value: string | null): ListSort | undefined {
  if (!value) return undefined;
  const [field, direction] = value.split(",");
  if (!field) return undefined;
  return { field, direction: direction === "desc" ? "desc" : "asc" };
}

/**
 * Trạng thái danh sách (trang, số dòng, sắp xếp, tìm kiếm, bộ lọc) lưu trên URL để chia sẻ link được:
 * `?page=2&size=20&sort=fullName,asc&q=lan&status=ACTIVE`. URL đánh số trang từ 1; `apiParams` đổi sang
 * quy ước API (page từ 0). Đổi tìm kiếm/bộ lọc/số dòng thì quay về trang 1.
 */
export function useListParams({ filterKeys = [], defaultSize = 20, defaultSort }: ListParamsOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sizeParam = Number(searchParams.get("size"));
  const size = (PAGE_SIZES as readonly number[]).includes(sizeParam) ? sizeParam : defaultSize;
  const sort = parseSort(searchParams.get("sort")) ?? defaultSort;
  const q = searchParams.get("q") ?? "";

  const filterKeyList = filterKeys.join("|");
  const filters = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of filterKeyList ? filterKeyList.split("|") : []) {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  }, [searchParams, filterKeyList]);

  /** Sửa URL; `resetPage` = về trang 1 (khi đổi điều kiện lọc). Dùng replace để không làm dài lịch sử. */
  const update = useCallback(
    (changes: Record<string, string | undefined>, resetPage: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback((value: number) => update({ page: value > 1 ? String(value) : undefined }, false), [update]);
  const setSize = useCallback((value: number) => update({ size: String(value) }, true), [update]);
  const setSort = useCallback(
    (value: ListSort | undefined) => update({ sort: value ? `${value.field},${value.direction}` : undefined }, false),
    [update],
  );
  const setSearch = useCallback((value: string) => update({ q: value.trim() || undefined }, true), [update]);
  const setFilter = useCallback((key: string, value: string | undefined) => update({ [key]: value }, true), [update]);
  const clearFilters = useCallback(() => {
    const cleared: Record<string, undefined> = { q: undefined };
    for (const key of filterKeyList ? filterKeyList.split("|") : []) cleared[key] = undefined;
    update(cleared, true);
  }, [update, filterKeyList]);

  /** Tham số gửi API (page từ 0). Đưa vào query key cùng schoolQueryKey. */
  const apiParams = useMemo(
    () => ({
      page: page - 1,
      size,
      ...(sort ? { sort: `${sort.field},${sort.direction}` } : {}),
      ...(q ? { q } : {}),
      ...filters,
    }),
    [page, size, sort, q, filters],
  );

  return {
    page,
    size,
    sort,
    q,
    filters,
    hasActiveFilters: q !== "" || Object.keys(filters).length > 0,
    setPage,
    setSize,
    setSort,
    setSearch,
    setFilter,
    clearFilters,
    apiParams,
  };
}

export type ListParams = ReturnType<typeof useListParams>;
