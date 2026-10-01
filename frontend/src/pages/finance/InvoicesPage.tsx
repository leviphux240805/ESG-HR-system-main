import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { ExportButton } from "@/components/common/ExportButton";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { formatMoney, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InvoiceSheet } from "@/features/finance/InvoiceSheet";
import { MonthNav } from "@/features/finance/MonthNav";
import { useMonthParam } from "@/features/finance/useMonthParam";
import { useFinanceAccess } from "@/features/finance/access";
import {
  INVOICE_FILTER_KEYS,
  INVOICE_STATUS,
  type GenerateResult,
  type InvoiceRow,
  exportInvoices,
  generateInvoices,
  issueInvoices,
  useClasses,
  useInvoiceSummary,
  useInvoices,
} from "@/api";

function Summary({ month }: { month: string }) {
  const { data } = useInvoiceSummary(month);
  if (!data) return <Skeleton className="mb-4 h-28" />;
  const rate = data.amountDue > 0 ? Math.min(100, Math.round((data.amountPaid / data.amountDue) * 100)) : 0;
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Phải thu</p>
          <p className="text-sm font-bold tabular-nums sm:text-xl">{formatMoney(data.amountDue)}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {data.total} phiếu{data.draft > 0 && ` · ${data.draft} nháp`}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Đã thu ({rate}%)</p>
          <p className="text-sm font-bold tabular-nums text-green-700 sm:text-xl">{formatMoney(data.amountPaid)}</p>
          <Progress value={rate} className="mt-2 h-2" aria-label="Tỷ lệ đã thu" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Còn phải thu</p>
          <p className="text-sm font-bold tabular-nums text-destructive sm:text-xl">{formatMoney(data.balance)}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {data.issued} chưa thu · {data.partial} thu một phần
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GenerateResultDialog({ result, onClose }: { result: GenerateResult | null; onClose: () => void }) {
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kết quả sinh phiếu</DialogTitle>
          <DialogDescription>
            Tạo mới {result?.created ?? 0} · cập nhật {result?.updated ?? 0} · bỏ qua {result?.skipped ?? 0} (đã phát hành)
          </DialogDescription>
        </DialogHeader>
        {result && result.warnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Cần kiểm tra ({result.warnings.length})</p>
            <ul className="space-y-1 text-sm">
              {result.warnings.map((w, i) => (
                <li key={i}>
                  <b>{w.childName}</b>: {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Phiếu thu theo tháng: sinh nháp, phát hành, thu tiền nhiều lần, xuất Excel, tải PDF. */
export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useMonthParam();
  const { canManage } = useFinanceAccess();
  const params = useListParams({ filterKeys: INVOICE_FILTER_KEYS });
  const query = useInvoices(month, params);
  const classes = useClasses();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvoiceRow[]>([]);
  const [confirm, setConfirm] = useState<"generate" | "issue" | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const selectedDrafts = selected.filter((r) => r.status === "DRAFT");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "status", label: "Trạng thái", options: Object.entries(INVOICE_STATUS).map(([value, m]) => ({ value, label: m.label })) },
      { type: "select", key: "classId", label: "Lớp", options: (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
      { type: "select", key: "overdue", label: "Quá hạn", options: [{ value: "true", label: "Chỉ phiếu quá hạn" }] },
    ],
    [classes.data],
  );

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        id: "childName",
        header: "Trẻ",
        enableHiding: false,
        cell: ({ row }) => (
          <button type="button" className="min-h-9 text-left font-medium hover:underline" onClick={() => setOpenId(row.original.id)}>
            {row.original.childName}
            <span className="block text-xs font-normal text-muted-foreground">{row.original.invoiceNo ?? "Nháp"}</span>
          </button>
        ),
      },
      { id: "className", header: "Lớp", cell: ({ row }) => row.original.className ?? "—" },
      {
        id: "amountDue",
        header: "Phải thu",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.amountDue)}</span>,
      },
      {
        id: "amountPaid",
        header: "Đã thu",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.amountPaid)}</span>,
      },
      {
        id: "balance",
        header: "Còn lại",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className={cn("tabular-nums", row.original.balance > 0 && "font-medium text-destructive")}>{formatMoney(row.original.balance)}</span>
        ),
      },
      {
        id: "status",
        header: "Trạng thái",
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={row.original.status} labels={INVOICE_STATUS} />
            {row.original.overdue && <span className="text-xs text-destructive">Quá hạn</span>}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Phiếu thu"
        description="Sinh phiếu nháp theo biểu phí, phát hành rồi ghi nhận thu tiền; nợ hoặc trả thừa tự chuyển sang kỳ sau."
        actions={<MonthNav month={month} onChange={setMonth} />}
      />
      <Summary month={month} />
      <div className="mb-3 flex flex-wrap gap-2">
        {canManage && (
          <>
            <Button className="min-h-11" onClick={() => setConfirm("generate")}>
              <FilePlus2 className="w-4 h-4 mr-2" /> Sinh phiếu
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirm("issue")}>
              <Send className="w-4 h-4 mr-2" /> {selectedDrafts.length > 0 ? `Phát hành ${selectedDrafts.length} phiếu` : "Phát hành tất cả nháp"}
            </Button>
          </>
        )}
        <ExportButton request={() => exportInvoices(month, params.filters)} fileName={`phieu-thu-${month}.xlsx`} />
      </div>
      <FilterBar params={params} searchPlaceholder="Tìm theo tên, mã trẻ, số phiếu" filters={filters} />
      <DataTable
        tableId="invoices"
        columns={columns}
        query={query}
        params={params}
        getRowId={(r) => r.id}
        onSelectionChange={canManage ? setSelected : undefined}
        mobileCard={(r) => (
          <button type="button" className="flex min-h-11 w-full items-center gap-3 text-left" onClick={() => setOpenId(r.id)}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.childName}</p>
              <p className="text-xs text-muted-foreground">
                {r.className ?? "—"} · {formatMoney(r.amountDue)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={r.status} labels={INVOICE_STATUS} />
              {r.balance > 0 && <span className="text-xs font-medium tabular-nums text-destructive">còn {formatMoney(r.balance)}</span>}
            </div>
          </button>
        )}
        emptyTitle="Chưa có phiếu thu"
        emptyDescription={canManage ? "Bấm “Sinh phiếu” để tạo phiếu nháp cho tháng này." : "Thử đổi tháng hoặc bộ lọc."}
      />

      <InvoiceSheet id={openId} onClose={() => setOpenId(null)} />
      <ConfirmDialog
        open={confirm === "generate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Sinh phiếu ${formatMonth(month)}?`}
        description="Tạo phiếu nháp cho mọi trẻ đang học; phiếu nháp đã có được tính lại, phiếu đã phát hành giữ nguyên."
        confirmText="Sinh phiếu"
        onConfirm={async () => {
          const res = await generateInvoices(month);
          setResult(res);
          await refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "issue"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={selectedDrafts.length > 0 ? `Phát hành ${selectedDrafts.length} phiếu đã chọn?` : `Phát hành mọi phiếu nháp ${formatMonth(month)}?`}
        description="Phiếu được cấp số, cộng nợ hoặc trả thừa kỳ trước và không sửa được nữa."
        confirmText="Phát hành"
        onConfirm={async () => {
          const res = await issueInvoices(month, selectedDrafts.length > 0 ? selectedDrafts.map((r) => r.id) : undefined);
          toast.success(`Đã phát hành ${res.issued} phiếu.`);
          await refresh();
        }}
      />
      <GenerateResultDialog result={result} onClose={() => setResult(null)} />
    </div>
  );
}
