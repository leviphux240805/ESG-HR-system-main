import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { FileDown, Loader2, Send, Trash2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  INVOICE_STATUS,
  PAYMENT_METHOD_LABELS,
  type InvoiceDetail,
  addPayment,
  applyApiErrors,
  cancelInvoice,
  errorMessage,
  invoicePdf,
  issueInvoice,
  saveExport,
  useInvoice,
  voidPayment,
} from "@/api";
import { moneyInput, parseMoney } from "./money";
import { ReasonDialog } from "./ReasonDialog";

const todayIso = () => new Date().toLocaleDateString("sv-SE");
const OPEN = ["ISSUED", "PARTIAL", "PAID"];

const paymentSchema = z.object({
  amount: moneyInput(),
  method: z.enum(["CASH", "TRANSFER"]),
  paidOn: z
    .string()
    .min(1, "Vui lòng chọn ngày thu")
    .refine((v) => v <= todayIso(), "Ngày thu không được sau hôm nay"),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

function PaymentForm({ inv, onDone }: { inv: InvoiceDetail; onDone: () => Promise<unknown> }) {
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: String(inv.invoice.balance), method: "TRANSFER", paidOn: todayIso(), reference: "", note: "" },
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await addPayment(inv.invoice.id, {
        amount: parseMoney(v.amount),
        method: v.method!,
        paidOn: v.paidOn!,
        reference: v.reference || undefined,
        note: v.note || undefined,
      });
      toast.success("Đã ghi nhận thu tiền.");
      await onDone();
    } catch (error) {
      applyApiErrors(error, form);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-3 rounded-xl border p-4" noValidate>
        <p className="font-medium">Ghi nhận thu tiền</p>
        <TextField form={form} name="amount" label="Số tiền (₫)" inputMode="numeric" required />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            form={form}
            name="method"
            label="Hình thức"
            options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <TextField form={form} name="paidOn" label="Ngày thu" type="date" required />
        </div>
        <TextField form={form} name="reference" label="Mã giao dịch" />
        <TextField form={form} name="note" label="Ghi chú" />
        <Button type="submit" className="min-h-11 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Ghi nhận
        </Button>
      </form>
    </Form>
  );
}

function Row({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <tr className={className}>
      <td className="py-1">{label}</td>
      <td className="py-1 text-right tabular-nums">{formatMoney(value)}</td>
    </tr>
  );
}

/** Chi tiết phiếu thu: các dòng, thanh toán nhiều lần, phát hành, hủy, tải PDF. */
export function InvoiceSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState(id);
  const query = useInvoice(currentId);
  const [confirm, setConfirm] = useState<"issue" | "delete" | null>(null);
  const [reasonFor, setReasonFor] = useState<{ kind: "cancel" } | { kind: "void"; paymentId: string } | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const detail = query.data;
  const inv = detail?.invoice;

  useEffect(() => setCurrentId(id), [id]);

  const refresh = () =>
    Promise.all(["finance", "children"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

  const downloadPdf = async () => {
    if (!inv) return;
    setPdfPending(true);
    try {
      await saveExport(await invoicePdf(inv.id), `${inv.invoiceNo ?? "phieu-thu"}.pdf`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPdfPending(false);
    }
  };

  const activePayments = detail?.payments.filter((p) => !p.voidedAt) ?? [];

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {query.isLoading ? (
          <PageSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : detail && inv ? (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle>{inv.invoiceNo ? `Phiếu thu ${inv.invoiceNo}` : "Phiếu thu nháp"}</SheetTitle>
              <SheetDescription>
                {inv.childName} · {inv.className ?? "—"} · {formatMonth(inv.periodMonth.slice(0, 7))}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={inv.status} labels={INVOICE_STATUS} />
              {inv.overdue && <span className="text-sm font-medium text-destructive">Quá hạn</span>}
              {inv.dueDate && <span className="text-sm text-muted-foreground">Hạn nộp {formatDate(inv.dueDate)}</span>}
            </div>
            {detail.carriedToId && (
              <p className="rounded-md bg-muted p-3 text-sm">
                Số dư đã chuyển sang phiếu{" "}
                <button type="button" className="min-h-11 font-medium underline" onClick={() => setCurrentId(detail.carriedToId!)}>
                  {detail.carriedToNo ?? "kỳ sau"}
                </button>
              </p>
            )}
            {detail.cancelReason && <p className="rounded-md bg-muted p-3 text-sm">Lý do hủy: {detail.cancelReason}</p>}

            <table className="w-full text-sm">
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="py-2 pr-2">
                      {l.description}
                      {(l.quantity !== 1 || l.note) && (
                        <span className="block text-xs text-muted-foreground">
                          {l.quantity !== 1 && `${l.quantity} × ${formatMoney(l.unitPrice)}`}
                          {l.quantity !== 1 && l.note && " · "}
                          {l.note}
                        </span>
                      )}
                    </td>
                    <td className={cn("py-2 text-right tabular-nums", l.amount < 0 && "text-green-700")}>{formatMoney(l.amount)}</td>
                  </tr>
                ))}
                <Row label="Phải thu" value={inv.amountDue} className="font-semibold" />
                <Row label="Đã thu" value={inv.amountPaid} className="text-green-700" />
                <Row label={inv.balance < 0 ? "Trả thừa" : "Còn phải thu"} value={Math.abs(inv.balance)} className={cn("font-semibold", inv.balance > 0 && "text-destructive")} />
              </tbody>
            </table>

            {detail.payments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Lịch sử thu</p>
                <ul className="space-y-2">
                  {detail.payments.map((p) => (
                    <li key={p.id} className={cn("flex items-start gap-2 text-sm", p.voidedAt && "text-muted-foreground")}>
                      <div className="min-w-0 flex-1">
                        <p className={cn(p.voidedAt && "line-through")}>
                          {formatDate(p.paidOn)} · {PAYMENT_METHOD_LABELS[p.method]} · <span className="tabular-nums">{formatMoney(p.amount)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[p.reference, p.receivedByName, p.note].filter(Boolean).join(" · ")}
                          {p.voidedAt && ` · Đã hủy: ${p.voidReason ?? ""}`}
                        </p>
                      </div>
                      {detail.canManage && !p.voidedAt && OPEN.includes(inv.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          aria-label="Hủy lần thu"
                          onClick={() => setReasonFor({ kind: "void", paymentId: p.id })}
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.canCollect && OPEN.includes(inv.status) && inv.balance > 0 && (
              <PaymentForm key={`${inv.id}-${inv.balance}`} inv={detail} onDone={refresh} />
            )}

            <div className="flex flex-wrap gap-2">
              {inv.status !== "DRAFT" && (
                <Button variant="outline" className="min-h-11" onClick={downloadPdf} disabled={pdfPending}>
                  {pdfPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />} Tải PDF
                </Button>
              )}
              {detail.canManage && inv.status === "DRAFT" && (
                <>
                  <Button className="min-h-11" onClick={() => setConfirm("issue")}>
                    <Send className="w-4 h-4 mr-2" /> Phát hành
                  </Button>
                  <Button variant="outline" className="min-h-11 text-destructive" onClick={() => setConfirm("delete")}>
                    <Trash2 className="w-4 h-4 mr-2" /> Xóa nháp
                  </Button>
                </>
              )}
              {detail.canManage && OPEN.includes(inv.status) && activePayments.length === 0 && (
                <Button variant="outline" className="min-h-11 text-destructive" onClick={() => setReasonFor({ kind: "cancel" })}>
                  <XCircle className="w-4 h-4 mr-2" /> Hủy phiếu
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>

      <ConfirmDialog
        open={confirm === "issue"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Phát hành phiếu thu?"
        description="Phiếu được cấp số, cộng nợ hoặc trả thừa kỳ trước và không sửa được nữa."
        confirmText="Phát hành"
        onConfirm={async () => {
          await issueInvoice(inv!.id);
          toast.success("Đã phát hành phiếu thu.");
          await refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Xóa phiếu nháp?"
        description="Có thể sinh lại phiếu cho trẻ này sau."
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await cancelInvoice(inv!.id);
          toast.success("Đã xóa phiếu nháp.");
          onClose();
          await refresh();
        }}
      />
      <ReasonDialog
        open={reasonFor !== null}
        onOpenChange={(o) => !o && setReasonFor(null)}
        title={reasonFor?.kind === "void" ? "Hủy lần thu này?" : "Hủy phiếu thu?"}
        description={
          reasonFor?.kind === "void"
            ? "Số tiền được trừ khỏi phiếu và sổ thu chi."
            : "Phiếu kỳ trước đã chuyển nợ vào phiếu này sẽ được mở lại."
        }
        confirmText={reasonFor?.kind === "void" ? "Hủy lần thu" : "Hủy phiếu"}
        onConfirm={async (reason) => {
          if (reasonFor?.kind === "void") await voidPayment(inv!.id, reasonFor.paymentId, reason);
          else await cancelInvoice(inv!.id, reason);
          toast.success("Đã hủy.");
          await refresh();
        }}
      />
    </Sheet>
  );
}
