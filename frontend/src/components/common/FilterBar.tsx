import { ReactNode, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ListParams } from "@/hooks/useListParams";

export type FilterDef =
  | { type: "select"; key: string; label: string; options: { value: string; label: string }[] }
  | { type: "dateRange"; fromKey: string; toKey: string; label: string };

interface FilterBarProps {
  params: ListParams;
  /** Bỏ trống để ẩn ô tìm kiếm. */
  searchPlaceholder?: string;
  filters?: FilterDef[];
  /** Thành phần thêm bên phải (ví dụ nút xuất Excel). */
  children?: ReactNode;
}

const ANY = "__all__";

/** Thanh tìm kiếm + bộ lọc; giá trị nằm trên URL (useListParams), tìm kiếm chờ 300 ms sau khi ngừng gõ. */
export function FilterBar({ params, searchPlaceholder = "Tìm kiếm...", filters = [], children }: FilterBarProps) {
  const [search, setSearch] = useState(params.q);
  const debounced = useDebouncedValue(search, 300);
  const { setSearch: applySearch, q } = params;

  useEffect(() => {
    if (debounced.trim() !== q) applySearch(debounced);
  }, [debounced, q, applySearch]);

  // URL đổi từ bên ngoài (Xóa lọc, quay lại trang) → đồng bộ ô nhập
  useEffect(() => {
    setSearch((current) => (current.trim() === q ? current : q));
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {searchPlaceholder && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9 min-h-11"
          />
        </div>
      )}

      {filters.map((filter) =>
        filter.type === "select" ? (
          <Select
            key={filter.key}
            value={params.filters[filter.key] ?? ANY}
            onValueChange={(value) => params.setFilter(filter.key, value === ANY ? undefined : value)}
          >
            <SelectTrigger className="w-full sm:w-48 min-h-11" aria-label={filter.label}>
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{filter.label}: tất cả</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div key={filter.fromKey} className="flex items-center gap-1 w-full sm:w-auto">
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filter.label}</span>
            <Input
              type="date"
              value={params.filters[filter.fromKey] ?? ""}
              onChange={(e) => params.setFilter(filter.fromKey, e.target.value || undefined)}
              aria-label={`${filter.label} từ ngày`}
              className="min-h-11 sm:w-40"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={params.filters[filter.toKey] ?? ""}
              onChange={(e) => params.setFilter(filter.toKey, e.target.value || undefined)}
              aria-label={`${filter.label} đến ngày`}
              className="min-h-11 sm:w-40"
            />
          </div>
        ),
      )}

      {params.hasActiveFilters && (
        <Button variant="ghost" onClick={params.clearFilters} className="min-h-11">
          <X className="w-4 h-4 mr-1" />
          Xóa lọc
        </Button>
      )}

      {children && <div className="flex items-center gap-2 sm:ml-auto">{children}</div>}
    </div>
  );
}
