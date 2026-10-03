import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, CheckCheck, ChevronLeft, ChevronRight, Lock, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ExportButton } from "@/components/common/ExportButton";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  approvePayroll,
  calculatePayroll,
  errorMessage,
  exportPayroll,
  PAYROLL_STATUS,
  type PayrollRow,
  payPayroll,
  reopenPayroll,
  usePayrollSheet,
} from "@/api";
import { currentMonth, formatDays, isMonth, monthLabel, shiftMonth } from "@/features/attendance/codes";
import { PayrollRecordSheet } from "@/features/payroll/PayrollRecordSheet";

type Action = "calculate" | "approve" | "pay";

const CONFIRM: Record<Action, { title: string; description: string; confirm: string; success: string }> = {
  calculate: { title: "Tính lương tháng này?", description: "Tính lại toàn bộ từ bảng công đã khóa và cấu hình lương; giữ thưởng, phạt đã nhập.", confirm: "Tính lương", success: "Đã tính lương." },
  approve: { title: "Duyệt bảng lương?", description: "Sau khi duyệt bảng lương không sửa được; nhân viên nhận thông báo phiếu lương.", confirm: "Duyệt", success: "Đã duyệt, nhân viên đã nhận phiếu lương." },
  pay: { title: "Đánh dấu đã trả lương?", description: "Ghi nhận đã chuyển lương cho toàn bộ nhân viên trong bảng.", confirm: "Đã trả", success: "Đã đánh dấu đã trả lương." },
};

const RUN: Record<Action, (month: string) => Promise<unknown>> = { calculate: calculatePayroll, approve: approvePayroll, pay: payPayroll };

function ReopenDialog({ month, open, onOpenChange, onDone }: { month: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await reopenPayroll(month, reason.trim());
      await onDone();
      toast.success("Đã mở lại bảng lương.");
      setReason("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mở lại bảng lương</DialogTitle>
          <DialogDescription>Bảng lương trở về nháp để sửa và tính lại; lý do được ghi lại.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do (bắt buộc)" rows={3} aria-label="Lý do mở lại" />
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)} disabled={busy}>
            Hủy
          </Button>
          <Button className="min-h-11" onClick={submit} disabled={busy || !reason.trim()}>
            Mở lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const money = (value: number) => <span className="tabular-nums">{formatMoney(value)}</span>;

/** Bảng lương tháng của trường: tính từ bảng công đã khóa, sửa thưởng/phạt, duyệt, trả, xuất Excel, phiếu lương. */
export default function PayrollPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = isMonth(monthParam) ? monthParam : currentMonth();
  const { isAllSchools, canChooseAll } = useCurrentSchool();
  const needSchool = canChooseAll && isAllSchools;
  const query = usePayrollSheet(month, !needSchool);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [reopening, setReopening] = useState(false);
  const [selected, setSelected] = useState<PayrollRow | null>(null);
  const sheet = query.data;
  const status = sheet?.status ?? "NONE";
  const draft = status === "NONE" || status === "DRAFT";

  const setMonth = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("month", value);
    setSearchParams(next, { replace: true });
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["payroll"] });

  return (
    <div>
      <PageHeader
        title="Bảng lương"
        description="Tính từ bảng công đã khóa và cấu hình lương; hiệu trưởng duyệt, nhân viên nhận phiếu lương trong app."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-[8.5rem] text-center font-medium">{monthLabel(month)}</span>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {needSchool ? (
        <EmptyState icon={Wallet} title="Chọn một trường" description="Bảng lương xem theo từng trường: chọn trường ở đầu trang." />
      ) : query.isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : sheet ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={status} labels={PAYROLL_STATUS} />
            {sheet.standardWorkDays != null && <span className="text-muted-foreground">Công chuẩn {formatDays(sheet.standardWorkDays)}</span>}
            {sheet.approvedAt && (
              <span className="text-muted-foreground">
                Duyệt {formatDateTime(sheet.approvedAt)}
                {sheet.approvedByName && ` bởi ${sheet.approvedByName}`}
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {sheet.canEdit && draft && (
                <Button className="min-h-11" variant={status === "NONE" ? "default" : "outline"} disabled={!sheet.attendanceLocked} onClick={() => setConfirm("calculate")}>
                  <Calculator className="w-4 h-4 mr-2" /> {status === "NONE" ? "Tính lương" : "Tính lại"}
                </Button>
              )}
              {sheet.canApprove && status === "DRAFT" && sheet.rows.length > 0 && (
                <Button className="min-h-11" onClick={() => setConfirm("approve")}>
                  <CheckCheck className="w-4 h-4 mr-2" /> Duyệt
                </Button>
              )}
              {sheet.canEdit && status === "APPROVED" && (
                <Button className="min-h-11" onClick={() => setConfirm("pay")}>
                  <Wallet className="w-4 h-4 mr-2" /> Đã trả
                </Button>
              )}
              {sheet.canApprove && status === "APPROVED" && (
                <Button variant="outline" className="min-h-11" onClick={() => setReopening(true)}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Mở lại
                </Button>
              )}
              {sheet.rows.length > 0 && <ExportButton request={() => exportPayroll(month)} fileName={`bang-luong-${month}.xlsx`} />}
            </div>
          </div>

          {!sheet.attendanceLocked && draft && (
            <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Lock className="w-4 h-4" /> Cần khóa bảng công tháng này trước khi tính lương.
              <Link to={`/cham-cong?month=${month}`} className="font-medium underline">
                Mở bảng công
              </Link>
            </p>
          )}
          {sheet.missingConfig.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" />
              Chưa tính cho {sheet.missingConfig.length} người chưa có cấu hình lương: {sheet.missingConfig.join(", ")}.
            </p>
          )}

          {sheet.rows.length === 0 ? (
            <EmptyState icon={Wallet} title="Chưa có bảng lương tháng này" description={sheet.canEdit ? "Khóa bảng công rồi bấm Tính lương." : undefined} />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table aria-label="Bảng lương">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[12rem]">Nhân viên</TableHead>
                    <TableHead className="text-right">Công</TableHead>
                    <TableHead className="text-right">Lương theo công</TableHead>
                    <TableHead className="text-right">Phụ cấp</TableHead>
                    <TableHead className="text-right">Thưởng</TableHead>
                    <TableHead className="text-right">Phạt</TableHead>
                    <TableHead className="text-right">Bảo hiểm</TableHead>
                    <TableHead className="text-right">Thuế TNCN</TableHead>
                    <TableHead className="text-right">Thực lĩnh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheet.rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell>
                        <button type="button" className="min-h-11 text-left font-medium hover:underline" aria-label={`Phiếu lương ${r.fullName}`}>
                          {r.fullName}
                          <span className="block text-xs font-normal text-muted-foreground">{r.staffCode}</span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDays(r.workDays)}</TableCell>
                      <TableCell className="text-right">{money(r.salaryByWork)}</TableCell>
                      <TableCell className="text-right">{money(r.allowances)}</TableCell>
                      <TableCell className="text-right">{money(r.bonus)}</TableCell>
                      <TableCell className="text-right">{money(r.fines)}</TableCell>
                      <TableCell className="text-right">{money(r.insuranceDeduction)}</TableCell>
                      <TableCell className="text-right">{money(r.pit)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(r.netSalary)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="font-medium">
                      Tổng cộng ({sheet.rows.length} người)
                    </TableCell>
                    <TableCell className="text-right">{money(sheet.totals.insuranceDeduction)}</TableCell>
                    <TableCell className="text-right">{money(sheet.totals.pit)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(sheet.totals.netSalary)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </div>
      ) : null}

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={CONFIRM[confirm].title}
          description={CONFIRM[confirm].description}
          confirmText={CONFIRM[confirm].confirm}
          onConfirm={async () => {
            await RUN[confirm](month);
            await refresh();
            toast.success(CONFIRM[confirm].success);
          }}
        />
      )}
      <ReopenDialog month={month} open={reopening} onOpenChange={setReopening} onDone={refresh} />
      <PayrollRecordSheet row={selected} editable={!!sheet?.canEdit && status === "DRAFT"} onClose={() => setSelected(null)} />
    </div>
  );
}
