import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { ExportButton } from "@/components/common/ExportButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  exportStaff,
  STAFF_FILTER_KEYS,
  type StaffListItem,
  useStaffList,
  useStaffSummary,
} from "@/features/staff/api";
import { options, POSITION_LABELS, type Position, STAFF_STATUS } from "@/features/staff/labels";
import { StaffAvatar } from "@/features/staff/StaffAvatar";
import { daysUntil, WARNING_DAYS } from "@/features/staff/dates";
import { useClasses } from "@/features/school/api";

function SummaryCards({ schoolId }: { schoolId?: string }) {
  const { data, isLoading } = useStaffSummary(schoolId);
  if (isLoading || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-3 mb-4 sm:mb-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  const topPositions = (Object.entries(data.byPosition) as [Position, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4 sm:mb-6">
      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Nhân sự đang làm</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="hidden sm:block">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-1">Theo vị trí</p>
          {topPositions.length === 0 ? (
            <p className="text-sm">—</p>
          ) : (
            <ul className="text-sm space-y-0.5">
              {topPositions.map(([position, count]) => (
                <li key={position} className="flex justify-between">
                  <span>{POSITION_LABELS[position]}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Link to="/nhan-su/giay-to-het-han" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="h-full hover:bg-accent/40 transition-colors">
          <CardContent className="pt-6 flex items-center gap-4">
            <AlertTriangle className={cn("w-8 h-8", data.expiringDocuments > 0 ? "text-amber-600" : "text-muted-foreground")} />
            <div>
              <p className="text-sm text-muted-foreground">Giấy tờ hết hạn trong {WARNING_DAYS} ngày</p>
              <p className="text-2xl font-bold">{data.expiringDocuments}</p>
              <p className="text-xs text-primary">Xem giấy tờ sắp hết hạn →</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

export default function StaffListPage() {
  const params = useListParams({ filterKeys: STAFF_FILTER_KEYS });
  const { schools, isAllSchools, canChooseAll } = useCurrentSchool();
  const query = useStaffList(params);
  const [selected, setSelected] = useState<StaffListItem[]>([]);
  const canCreate = useCan("manage", "staff");
  const classes = useClasses();
  const classesOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of classes.data ?? []) for (const t of c.teachers) map.set(t.id, [...(map.get(t.id) ?? []), c.name]);
    return map;
  }, [classes.data]);

  const filters = useMemo<FilterDef[]>(() => {
    const list: FilterDef[] = [];
    // Lọc cơ sở chỉ có ý nghĩa khi cấp chuỗi đang xem "Tất cả cơ sở"
    if (canChooseAll && isAllSchools) {
      list.push({ type: "select", key: "schoolId", label: "Cơ sở", options: schools.map((s) => ({ value: s.id, label: s.name })) });
    }
    list.push(
      { type: "select", key: "position", label: "Vị trí", options: options(POSITION_LABELS) },
      { type: "select", key: "status", label: "Trạng thái", options: [
        { value: "ACTIVE", label: "Đang làm" },
        { value: "TERMINATED", label: "Đã nghỉ" },
      ] },
      { type: "select", key: "contractExpiring", label: "Hợp đồng", options: [{ value: "true", label: "Sắp hết hạn (30 ngày)" }] },
    );
    return list;
  }, [canChooseAll, isAllSchools, schools]);

  const columns = useMemo<ColumnDef<StaffListItem>[]>(
    () => [
      { id: "staffCode", accessorKey: "staffCode", header: "Mã NV", enableSorting: true, enableHiding: false },
      {
        id: "fullName",
        accessorKey: "fullName",
        header: "Họ tên",
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-[12rem]">
            <StaffAvatar fullName={row.original.fullName} photoUrl={row.original.photoUrl} />
            <div className="min-w-0">
              <Link to={`/nhan-su/${row.original.id}`} className="font-medium truncate block hover:underline">
                {row.original.fullName}
              </Link>
              {row.original.phone && <p className="text-xs text-muted-foreground">{row.original.phone}</p>}
            </div>
          </div>
        ),
      },
      { id: "position", accessorKey: "position", header: "Vị trí", enableSorting: true, cell: ({ row }) => POSITION_LABELS[row.original.position] },
      ...(isAllSchools ? [{ id: "schoolName", accessorKey: "schoolName", header: "Cơ sở" } as ColumnDef<StaffListItem>] : []),
      {
        id: "classes",
        header: "Lớp phụ trách",
        meta: { label: "Lớp phụ trách" },
        cell: ({ row }) => classesOf.get(row.original.id)?.join(", ") ?? <span className="text-muted-foreground">—</span>,
      },
      { id: "startDate", accessorKey: "startDate", header: "Ngày vào làm", enableSorting: true, cell: ({ row }) => formatDate(row.original.startDate) },
      { id: "status", accessorKey: "status", header: "Trạng thái", cell: ({ row }) => <StatusBadge status={row.original.status} labels={STAFF_STATUS} /> },
      {
        id: "contractEndDate",
        header: "Hạn hợp đồng",
        meta: { label: "Hạn hợp đồng" },
        cell: ({ row }) => {
          const end = row.original.contractEndDate;
          if (!end) return <span className="text-muted-foreground">—</span>;
          const days = daysUntil(end);
          return (
            <span className={cn(days < WARNING_DAYS && "text-destructive font-medium")} title={days < 0 ? "Đã hết hạn" : `Còn ${days} ngày`}>
              {formatDate(end)}
            </span>
          );
        },
      },
    ],
    [classesOf, isAllSchools],
  );

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description="Hồ sơ nhân viên theo cơ sở đang chọn."
        actions={
          <>
            {canCreate && (
              <Button asChild className="min-h-11">
                <Link to="/nhan-su/moi">
                  <Plus className="w-4 h-4 mr-2" /> Thêm nhân viên
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/nhan-su/de-xuat">
                <ClipboardCheck className="w-4 h-4 mr-2" /> Đề xuất cập nhật
              </Link>
            </Button>
            {selected.length > 0 && (
              <ExportButton
                label={`Xuất ${selected.length} đã chọn`}
                fileName="danh-sach-nhan-su.xlsx"
                request={() => exportStaff(params, selected.map((s) => s.id))}
              />
            )}
            <ExportButton fileName="danh-sach-nhan-su.xlsx" request={() => exportStaff(params)} />
          </>
        }
      />
      <SummaryCards schoolId={params.filters.schoolId} />
      <FilterBar params={params} searchPlaceholder="Tìm theo tên, mã NV, số điện thoại" filters={filters} />
      <DataTable
        tableId="staff"
        columns={columns}
        query={query}
        params={params}
        getRowId={(row) => row.id}
        onSelectionChange={setSelected}
        mobileCard={(row) => (
          <Link to={`/nhan-su/${row.id}`} className="flex min-h-11 items-center gap-3">
            <StaffAvatar fullName={row.fullName} photoUrl={row.photoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {POSITION_LABELS[row.position]}
                {classesOf.get(row.id) ? ` · ${classesOf.get(row.id)!.join(", ")}` : ""}
              </p>
              {row.contractEndDate && daysUntil(row.contractEndDate) < WARNING_DAYS && (
                <p className="text-xs font-medium text-destructive">Hợp đồng hết hạn {formatDate(row.contractEndDate)}</p>
              )}
            </div>
            <StatusBadge status={row.status} labels={STAFF_STATUS} />
          </Link>
        )}
        emptyTitle="Chưa có nhân viên"
        emptyDescription="Nhân viên được thêm sẽ hiện ở đây."
      />
    </div>
  );
}
