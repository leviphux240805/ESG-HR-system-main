import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { useListParams } from "@/hooks/useListParams";
import { formatDate, formatMoney } from "@/lib/format";
import { InvoiceSheet } from "@/features/finance/InvoiceSheet";
import { RECEIVABLE_FILTER_KEYS, type ReceivableRow, useClasses, useReceivableSummary, useReceivables } from "@/api";

function Summary() {
  const { data } = useReceivableSummary();
  if (!data) return <Skeleton className="mb-4 h-24" />;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Tổng còn nợ ({data.children} trẻ)</p>
          <p className="text-sm font-bold tabular-nums sm:text-xl">{formatMoney(data.balance)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Quá hạn ({data.overdueChildren} trẻ)</p>
          <p className="text-sm font-bold tabular-nums text-destructive sm:text-xl">{formatMoney(data.overdueBalance)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Công nợ: trẻ còn nợ trên các phiếu đang mở, nhiều nhất lên đầu. */
export default function ReceivablesPage() {
  const params = useListParams({ filterKeys: RECEIVABLE_FILTER_KEYS });
  const query = useReceivables(params);
  const classes = useClasses();
  const [openId, setOpenId] = useState<string | null>(null);

  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "classId", label: "Lớp", options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
      { type: "select", key: "overdue", label: "Quá hạn", options: [{ value: "true", label: "Chỉ trẻ nợ quá hạn" }] },
    ],
    [classes.data],
  );

  const columns = useMemo<ColumnDef<ReceivableRow>[]>(
    () => [
      {
        id: "childName",
        header: "Trẻ",
        enableHiding: false,
        cell: ({ row }) => (
          <Link to={`/tre/${row.original.childId}?tab=hoc-phi`} className="font-medium hover:underline">
            {row.original.childName}
            <span className="block text-xs font-normal text-muted-foreground">{row.original.childCode}</span>
          </Link>
        ),
      },
      { id: "className", header: "Lớp", cell: ({ row }) => row.original.className ?? "—" },
      { id: "invoiceCount", header: "Số phiếu", meta: { align: "right" }, cell: ({ row }) => row.original.invoiceCount },
      {
        id: "oldestDueDate",
        header: "Hạn sớm nhất",
        cell: ({ row }) => (
          <span>
            {row.original.oldestDueDate ? formatDate(row.original.oldestDueDate) : "—"}
            {row.original.overdueDays > 0 && <span className="block text-xs text-destructive">quá {row.original.overdueDays} ngày</span>}
          </span>
        ),
      },
      {
        id: "balance",
        header: "Còn nợ",
        enableHiding: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <button type="button" className="min-h-9 font-medium tabular-nums text-destructive hover:underline" onClick={() => setOpenId(row.original.latestInvoiceId)}>
            {formatMoney(row.original.balance)}
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Công nợ" description="Trẻ còn nợ học phí trên các phiếu đã phát hành; bấm số tiền để mở phiếu gần nhất và thu tiền." />
      <Summary />
      <FilterBar params={params} searchPlaceholder="Tìm theo tên, mã trẻ" filters={filters} />
      <DataTable
        tableId="receivables"
        columns={columns}
        query={query}
        params={params}
        getRowId={(r) => r.childId}
        mobileCard={(r) => (
          <button type="button" className="flex min-h-11 w-full items-center gap-3 text-left" onClick={() => setOpenId(r.latestInvoiceId)}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.childName}</p>
              <p className="text-xs text-muted-foreground">
                {r.className ?? "—"} · {r.invoiceCount} phiếu
                {r.overdueDays > 0 && <span className="text-destructive"> · quá {r.overdueDays} ngày</span>}
              </p>
            </div>
            <span className="font-medium tabular-nums text-destructive">{formatMoney(r.balance)}</span>
          </button>
        )}
        emptyTitle="Không có công nợ"
        emptyDescription="Mọi phiếu đã phát hành đều đã thu đủ."
      />
      <InvoiceSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
