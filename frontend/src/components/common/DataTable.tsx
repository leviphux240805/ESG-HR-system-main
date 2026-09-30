import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowData,
  type RowSelectionState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Paged } from "@/api/paging";
import { usePermissions } from "@/hooks/useCan";
import { type ListParams, PAGE_SIZES } from "@/hooks/useListParams";
import type { Action, Resource } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, TableSkeleton } from "./States";

/** Thông tin thêm cho cột DataTable (khai báo qua `meta` của ColumnDef). */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Tên cột trong menu ẩn/hiện (mặc định lấy header dạng chữ). */
    label?: string;
    /** Chỉ hiện cột khi có quyền (ví dụ cột lương). */
    permission?: { action: Action; resource: Resource };
    /** Căn phải (cột tiền, số). */
    align?: "right";
  }
}

interface DataTableProps<T> {
  /** Khóa lưu lựa chọn ẩn/hiện cột (localStorage). */
  tableId: string;
  /** `id` của cột có sắp xếp là tên trường sắp xếp gửi API; bật bằng `enableSorting: true`. */
  columns: ColumnDef<T>[];
  /** Kết quả useQuery trả Paged<T>. */
  query: { data?: Paged<T>; isLoading: boolean; isFetching?: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  params: ListParams;
  getRowId: (row: T) => string;
  /** Bật cột chọn nhiều dòng; nhận các dòng đang chọn (trong trang hiện tại). */
  onSelectionChange?: (rows: T[]) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** Điện thoại (< 768px): hiện mỗi dòng thành một thẻ thay cho bảng nhiều cột. */
  mobileCard?: (row: T) => ReactNode;
}

function loadVisibility(tableId: string): VisibilityState {
  try {
    return JSON.parse(localStorage.getItem(`preschool.table.${tableId}.columns`) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Bảng dữ liệu phân trang/sắp xếp phía server, trạng thái trên URL (useListParams). Tự hiện skeleton khi tải,
 * ErrorState khi lỗi, EmptyState khi rỗng. Header dính khi cuộn; màn hình hẹp cuộn ngang.
 */
export function DataTable<T>({
  tableId,
  columns,
  query,
  params,
  getRowId,
  onSelectionChange,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription,
  emptyAction,
  mobileCard,
}: DataTableProps<T>) {
  const check = usePermissions();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => loadVisibility(tableId));
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const selectable = !!onSelectionChange;
  // Callback của trang thường là hàm inline: giữ trong ref để không kích hoạt effect/tạo lại cột mỗi lần render
  const callbacks = useRef({ onSelectionChange, getRowId });
  callbacks.current = { onSelectionChange, getRowId };

  const allowedColumns = useMemo(() => {
    const visible = columns.filter((c) => !c.meta?.permission || check(c.meta.permission.action, c.meta.permission.resource));
    if (!selectable) return visible;
    const select: ColumnDef<T> = {
      id: "__select",
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
          aria-label="Chọn tất cả dòng trong trang"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          aria-label="Chọn dòng"
        />
      ),
    };
    return [select, ...visible];
  }, [columns, check, selectable]);

  const table = useReactTable({
    data: rows,
    columns: allowedColumns,
    getRowId: (row) => callbacks.current.getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: true,
    state: { columnVisibility, rowSelection },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  useEffect(() => {
    try {
      localStorage.setItem(`preschool.table.${tableId}.columns`, JSON.stringify(columnVisibility));
    } catch {
      // Không lưu được lựa chọn cột: không ảnh hưởng chức năng
    }
  }, [tableId, columnVisibility]);

  // Đổi trang/bộ lọc thì bỏ chọn
  useEffect(() => setRowSelection({}), [rows]);

  useEffect(() => {
    const { onSelectionChange: notify, getRowId: idOf } = callbacks.current;
    notify?.(rows.filter((row) => rowSelection[idOf(row)]));
  }, [rowSelection, rows]);

  const toggleSort = (field: string) => {
    const current = params.sort?.field === field ? params.sort.direction : undefined;
    if (!current) params.setSort({ field, direction: "asc" });
    else if (current === "asc") params.setSort({ field, direction: "desc" });
    else params.setSort(undefined);
  };

  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const data = query.data;

  let body: ReactNode;
  if (query.isLoading && !data) {
    body = <TableSkeleton columns={Math.min(allowedColumns.length, 6)} />;
  } else if (query.isError && !data) {
    body = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  } else if (rows.length === 0) {
    body = params.hasActiveFilters ? (
      <EmptyState
        title="Không có kết quả phù hợp"
        description="Thử đổi từ khóa hoặc bộ lọc."
        action={
          <Button variant="outline" onClick={params.clearFilters} className="min-h-11">
            Xóa lọc
          </Button>
        }
      />
    ) : (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  const from = data && data.totalElements > 0 ? data.page * data.size + 1 : 0;
  const to = data ? Math.min((data.page + 1) * data.size, data.totalElements) : 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  return (
    <div className="rounded-lg border bg-card">
      {hideableColumns.length > 1 && (
        <div className={cn("flex justify-end p-2 border-b", mobileCard && "hidden md:flex")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-h-11">
                <Columns3 className="w-4 h-4 mr-2" />
                Cột hiển thị
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Cột hiển thị</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(value === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {column.columnDef.meta?.label ??
                    (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {!body && mobileCard && (
        <ul className={cn("divide-y md:hidden", query.isFetching && "opacity-60 transition-opacity")}>
          {rows.map((row) => (
            <li key={getRowId(row)} className="p-3">
              {mobileCard(row)}
            </li>
          ))}
        </ul>
      )}

      {body ? (
        <div className="p-4">{body}</div>
      ) : (
        <div className={cn("max-h-[70vh] overflow-auto", mobileCard && "hidden md:block", query.isFetching && "opacity-60 transition-opacity")}>
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const sortable = header.column.getCanSort();
                    const direction = params.sort?.field === header.column.id ? params.sort.direction : undefined;
                    const label = header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext());
                    return (
                      <TableHead
                        key={header.id}
                        className={cn("whitespace-nowrap", header.column.columnDef.meta?.align === "right" && "text-right")}
                        aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(header.column.id)}
                            className="inline-flex items-center gap-1 min-h-11 hover:text-foreground"
                          >
                            {label}
                            {direction === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5" />
                            ) : direction === "desc" ? (
                              <ArrowDown className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                            )}
                          </button>
                        ) : (
                          label
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}

      {data && data.totalElements > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t text-sm">
          <span className="text-muted-foreground">
            Hiển thị {from}–{to} / {data.totalElements}
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(params.size)} onValueChange={(value) => params.setSize(Number(value))}>
              <SelectTrigger className="hidden w-28 min-h-11 sm:flex" aria-label="Số dòng mỗi trang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} dòng
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => params.setPage(params.page - 1)}
              disabled={params.page <= 1}
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="whitespace-nowrap">
              Trang {params.page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => params.setPage(params.page + 1)}
              disabled={params.page >= totalPages}
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
