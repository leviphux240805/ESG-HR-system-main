import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Phone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListParams } from "@/hooks/useListParams";
import { formatMoney, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentMonth, isMonth, shiftMonth } from "@/features/attendance/codes";
import { useClasses } from "@/features/school/api";
import { INVOICE_FILTER_KEYS, INVOICE_STATUS, type InvoiceItem, useDebts, useFeeSummary, useInvoices } from "@/features/finance/api";
import { InvoiceSheet } from "@/features/finance/InvoiceSheet";

function Summary({ month }: { month: string }) {
  const { data } = useFeeSummary(month);
  if (!data) return <Skeleton className="mb-4 h-28" />;
  const rate = data.total ? Math.round((data.collected / data.total) * 100) : 0;
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Phải thu</p>
          <p className="text-xl font-bold tabular-nums">{formatMoney(data.total)}</p>
          <p className="text-xs text-muted-foreground">{data.counts.PAID + data.counts.PARTIAL + data.counts.UNPAID} phiếu</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Đã thu ({rate}%)</p>
          <p className="text-xl font-bold tabular-nums text-green-700">{formatMoney(data.collected)}</p>
          <Progress value={rate} className="mt-2 h-2" aria-label="Tỷ lệ đã thu" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Còn phải thu</p>
          <p className="text-xl font-bold tabular-nums text-destructive">{formatMoney(data.outstanding)}</p>
          <p className="text-xs text-muted-foreground">
            {data.counts.UNPAID} chưa thu · {data.counts.PARTIAL} thu một phần
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InvoicesTab({ month, onOpen }: { month: string; onOpen: (id: string) => void }) {
  const params = useListParams({ filterKeys: INVOICE_FILTER_KEYS, defaultSort: { field: "className", direction: "asc" } });
  const query = useInvoices(month, params);
  const classes = useClasses();
  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "status", label: "Trạng thái", options: Object.entries(INVOICE_STATUS).map(([value, m]) => ({ value, label: m.label })) },
      { type: "select", key: "classId", label: "Lớp", options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
    ],
    [classes.data],
  );
  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        id: "childName",
        accessorKey: "childName",
        header: "Trẻ",
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <button type="button" className="min-h-9 text-left font-medium hover:underline" onClick={() => onOpen(row.original.id)}>
            {row.original.childName}
            <span className="block text-xs font-normal text-muted-foreground">{row.original.code}</span>
          </button>
        ),
      },
      { id: "className", accessorKey: "className", header: "Lớp", enableSorting: true },
      { id: "total", accessorKey: "total", header: "Phải thu", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.total)}</span> },
      { id: "paid", accessorKey: "paid", header: "Đã thu", meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.paid)}</span> },
      {
        id: "balance",
        accessorKey: "balance",
        header: "Còn lại",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => <span className={cn("tabular-nums", row.original.balance > 0 && "font-medium text-destructive")}>{formatMoney(row.original.balance)}</span>,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Trạng thái",
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={row.original.status} labels={INVOICE_STATUS} />
            {row.original.overdue && <span className="text-xs text-destructive">Quá hạn</span>}
          </div>
        ),
      },
    ],
    [onOpen],
  );
  return (
    <>
      <FilterBar params={params} searchPlaceholder="Tìm theo tên trẻ, số phiếu" filters={filters} />
      <DataTable tableId="invoices" columns={columns} query={query} params={params} getRowId={(r) => r.id} emptyTitle="Không có phiếu thu" emptyDescription="Thử đổi tháng hoặc bộ lọc." />
    </>
  );
}

function DebtsTab() {
  const query = useDebts();
  if (query.isLoading) return <TableSkeleton rows={6} columns={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const list = query.data ?? [];
  if (list.length === 0) return <EmptyState icon={Wallet} title="Không có công nợ quá hạn" description="Mọi phiếu thu quá hạn đã được thu đủ." />;
  const total = list.reduce((s, d) => s + d.balance, 0);
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {list.length} trẻ còn nợ quá hạn, tổng <b className="text-destructive">{formatMoney(total)}</b>
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((d) => (
          <li key={d.childId}>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.childName}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.className} · {d.months.map(formatMonth).join(", ")}
                  </p>
                  <p className="font-semibold tabular-nums text-destructive">{formatMoney(d.balance)}</p>
                </div>
                <Button asChild variant="outline" className="min-h-11 shrink-0">
                  <a href={`tel:${d.guardianPhone}`} aria-label={`Gọi ${d.guardianName}`}>
                    <Phone className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">{d.guardianName}</span>
                  </a>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Học phí: phiếu thu theo tháng (thu tiền ngay trên phiếu) và công nợ quá hạn. */
export default function FeesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = isMonth(searchParams.get("month")) ? searchParams.get("month")! : currentMonth();
  const tab = searchParams.get("tab") === "cong-no" ? "cong-no" : "phieu-thu";
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Học phí"
        description="Phiếu thu tháng gồm học phí, tiền ăn (hoàn tiền ăn ngày nghỉ có phép) và năng khiếu."
        actions={
          tab === "phieu-thu" && (
            <div className="flex items-center gap-1" role="group" aria-label="Chọn tháng">
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => set("month", shiftMonth(month, -1))} aria-label="Tháng trước">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[8.5rem] text-center font-medium">{formatMonth(month)}</span>
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => set("month", shiftMonth(month, 1))} aria-label="Tháng sau">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => set("tab", v)}>
        <TabsList className="mb-4">
          <TabsTrigger value="phieu-thu" className="min-h-9">Phiếu thu</TabsTrigger>
          <TabsTrigger value="cong-no" className="min-h-9">Công nợ</TabsTrigger>
        </TabsList>
        <TabsContent value="phieu-thu">
          <Summary month={month} />
          <InvoicesTab month={month} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="cong-no">
          <DebtsTab />
        </TabsContent>
      </Tabs>
      <InvoiceSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
