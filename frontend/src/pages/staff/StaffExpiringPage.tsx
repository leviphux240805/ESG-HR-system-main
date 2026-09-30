import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate } from "@/lib/format";
import {
  EXPIRING_FILTER_KEYS,
  EXPIRING_WINDOWS,
  type ExpiringItem,
  type ExpiryKind,
  useExpiringDocuments,
} from "@/features/staff/api";
import { WARNING_DAYS } from "@/features/staff/dates";

const KIND_LABELS: Record<ExpiryKind, string> = {
  CONTRACT: "Hợp đồng",
  CERTIFICATE: "Chứng chỉ",
  DOCUMENT: "Giấy tờ",
};

const profileLink = (row: ExpiringItem) => `/nhan-su/${row.staffId}?tab=${row.tab}`;

/** Hợp đồng, chứng chỉ, giấy tờ có hạn của nhân viên đang làm sắp hết hạn; bấm để mở đúng tab hồ sơ. */
export default function StaffExpiringPage() {
  const params = useListParams({ filterKeys: EXPIRING_FILTER_KEYS });
  const { schools, isAllSchools, canChooseAll } = useCurrentSchool();
  const query = useExpiringDocuments(params);
  const within = EXPIRING_WINDOWS.includes(params.filters.within as never) ? params.filters.within : "30";

  const filters = useMemo<FilterDef[]>(() => {
    const list: FilterDef[] = [
      { type: "select", key: "kind", label: "Loại", options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })) },
    ];
    if (canChooseAll && isAllSchools) {
      list.push({ type: "select", key: "schoolId", label: "Cơ sở", options: schools.map((s) => ({ value: s.id, label: s.name })) });
    }
    return list;
  }, [canChooseAll, isAllSchools, schools]);

  const columns = useMemo<ColumnDef<ExpiringItem>[]>(
    () => [
      {
        id: "expiryDate",
        header: "Hết hạn",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span>{formatDate(row.original.expiryDate)}</span>
            <StatusBadge
              status="LEFT"
              labels={{
                LEFT: {
                  label: row.original.daysLeft === 0 ? "Hôm nay" : `Còn ${row.original.daysLeft} ngày`,
                  tone: row.original.daysLeft < WARNING_DAYS ? "danger" : "warning",
                },
              }}
            />
          </div>
        ),
      },
      {
        id: "title",
        header: "Giấy tờ",
        enableHiding: false,
        cell: ({ row }) => (
          <Link to={profileLink(row.original)} className="font-medium hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      { id: "kind", header: "Loại", cell: ({ row }) => KIND_LABELS[row.original.kind as ExpiryKind] ?? row.original.kind },
      {
        id: "staff",
        header: "Nhân viên",
        cell: ({ row }) => (
          <Link to={profileLink(row.original)} className="hover:underline">
            {row.original.staffName} <span className="text-muted-foreground">({row.original.staffCode})</span>
          </Link>
        ),
      },
      { id: "schoolName", header: "Cơ sở", cell: ({ row }) => row.original.schoolName },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Giấy tờ sắp hết hạn"
        description="Hợp đồng, chứng chỉ và giấy tờ có hạn của nhân viên đang làm. Bấm vào dòng để mở hồ sơ và gia hạn."
        breadcrumbs={[{ label: "Nhân sự", to: "/nhan-su" }, { label: "Giấy tờ sắp hết hạn" }]}
      />
      <FilterBar params={params} searchPlaceholder="" filters={filters}>
        <ToggleGroup
          type="single"
          value={within}
          onValueChange={(v) => v && params.setFilter("within", v === "30" ? undefined : v)}
          aria-label="Trong vòng"
          className="border rounded-md p-0.5"
        >
          {EXPIRING_WINDOWS.map((w) => (
            <ToggleGroupItem key={w} value={w} className="min-h-10 px-3" aria-label={`${w} ngày tới`}>
              {w} ngày
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FilterBar>
      <DataTable
        tableId="staff-expiring"
        columns={columns}
        query={query}
        params={params}
        getRowId={(row) => `${row.kind}-${row.recordId}`}
        emptyTitle={`Không có giấy tờ nào hết hạn trong ${within} ngày tới`}
        emptyDescription="Hợp đồng, chứng chỉ và giấy tờ có hạn của nhân viên đang làm sẽ hiện ở đây khi gần hết hạn."
      />
    </div>
  );
}
