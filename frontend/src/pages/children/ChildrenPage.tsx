import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { useCan } from "@/hooks/useCan";
import { useListParams } from "@/hooks/useListParams";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHILD_FILTER_KEYS, type ChildItem, useChildren, useClasses } from "@/api";
import { formatAge } from "@/features/school/age";
import { ChildSheet } from "@/features/school/ChildSheet";
import { StaffAvatar } from "@/features/staff/StaffAvatar";

export default function ChildrenPage() {
  const params = useListParams({ filterKeys: CHILD_FILTER_KEYS, defaultSort: { field: "fullName", direction: "asc" } });
  const query = useChildren(params);
  const classes = useClasses();
  const canManage = useCan("manage", "approvals");
  const [creating, setCreating] = useState(false);

  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "classId", label: "Lớp", options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
      { type: "select", key: "gender", label: "Giới tính", options: [{ value: "FEMALE", label: "Bé gái" }, { value: "MALE", label: "Bé trai" }] },
    ],
    [classes.data],
  );

  const columns = useMemo<ColumnDef<ChildItem>[]>(
    () => [
      { id: "code", accessorKey: "code", header: "Mã trẻ", enableHiding: false },
      {
        id: "fullName",
        accessorKey: "fullName",
        header: "Họ tên",
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-[12rem] items-center gap-3">
            <StaffAvatar fullName={row.original.fullName} />
            <div className="min-w-0">
              <Link to={`/tre/${row.original.id}`} className="block truncate font-medium hover:underline">
                {row.original.fullName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {row.original.nickname} · {row.original.gender === "MALE" ? "Nam" : "Nữ"}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "dob",
        accessorKey: "dob",
        header: "Ngày sinh",
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            {formatDate(row.original.dob)}
            <p className="text-xs text-muted-foreground">{formatAge(row.original.dob)}</p>
          </div>
        ),
      },
      { id: "className", accessorKey: "className", header: "Lớp", enableSorting: true },
      {
        id: "guardian",
        header: "Phụ huynh",
        meta: { label: "Phụ huynh" },
        cell: ({ row }) => (
          <div>
            {row.original.guardianName}
            <a href={`tel:${row.original.guardianPhone}`} className="block text-xs text-primary">
              {row.original.guardianPhone}
            </a>
          </div>
        ),
      },
      {
        id: "allergies",
        header: "Dị ứng",
        meta: { label: "Dị ứng" },
        cell: ({ row }) => (row.original.allergies ? <Badge variant="destructive">{row.original.allergies}</Badge> : <span className="text-muted-foreground">—</span>),
      },
      {
        id: "attendanceRate",
        accessorKey: "attendanceRate",
        header: "Đi học 30 ngày",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => <span className={cn("font-medium", row.original.attendanceRate < 85 && "text-destructive")}>{row.original.attendanceRate}%</span>,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Hồ sơ trẻ"
        description="Danh sách trẻ theo lớp, thông tin phụ huynh, dị ứng và tỷ lệ đi học."
        actions={
          canManage && (
            <Button className="min-h-11" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" /> Thêm trẻ
            </Button>
          )
        }
      />
      <FilterBar params={params} searchPlaceholder="Tìm theo tên, tên gọi, mã, phụ huynh" filters={filters} />
      <DataTable
        tableId="children"
        columns={columns}
        query={query}
        params={params}
        getRowId={(row) => row.id}
        mobileCard={(c) => (
          <Link to={`/tre/${c.id}`} className="flex min-h-11 items-center gap-3">
            <StaffAvatar fullName={c.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {c.fullName} <span className="font-normal text-muted-foreground">({c.nickname})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {c.className} · {formatAge(c.dob)}
              </p>
              {c.allergies && <p className="text-xs font-medium text-destructive">{c.allergies}</p>}
            </div>
            <span className={cn("text-sm font-semibold tabular-nums", c.attendanceRate < 85 && "text-destructive")}>{c.attendanceRate}%</span>
          </Link>
        )}
        emptyTitle="Không có trẻ phù hợp"
        emptyDescription="Thử bỏ bớt bộ lọc hoặc tìm theo tên khác."
      />
      <ChildSheet open={creating} onOpenChange={setCreating} defaultClassId={params.filters.classId} />
    </div>
  );
}
