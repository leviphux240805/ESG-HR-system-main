import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { errorMessage } from "@/api";
import { useCan } from "@/hooks/useCan";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { INVOICE_STATUS, recordPayment, useInvoice } from "@/api";

const todayIso = () => new Date().toLocaleDateString("sv-SE");

/** Chi tiết phiếu thu và ghi nhận thu tiền. */
export function InvoiceSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const query = useInvoice(id);
  const canCollect = useCan("manage", "finance");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "TRANSFER">("TRANSFER");
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const inv = query.data;

  useEffect(() => {
    if (inv) setAmount(String(inv.balance));
  }, [inv]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inv) return;
    setBusy(true);
    try {
      await recordPayment(inv.id, { amount: Number(amount.replace(/\D/g, "")), method, date });
      await Promise.all(["invoices", "children"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      toast.success("Đã ghi nhận thu tiền.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {query.isLoading ? (
          <PageSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : inv ? (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle>Phiếu thu {inv.code}</SheetTitle>
              <SheetDescription>
                {inv.childName} · {inv.className} · {formatMonth(inv.month)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={inv.status} labels={INVOICE_STATUS} />
              <Button asChild variant="outline" className="min-h-11">
                <a href={`tel:${inv.guardianPhone}`}>
                  <Phone className="w-4 h-4 mr-2" /> {inv.guardianName}
                </a>
              </Button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.name} className="border-b">
                    <td className="py-2 pr-2">{l.name}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Tổng</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(inv.total)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-muted-foreground">Đã thu</td>
                  <td className="py-1 text-right tabular-nums text-green-700">{formatMoney(inv.paid)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-1">Còn phải thu</td>
                  <td className="py-1 text-right tabular-nums text-destructive">{formatMoney(inv.balance)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-muted-foreground">Hạn nộp {formatDate(inv.dueDate)}</p>

            {inv.payments.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Lịch sử thu</p>
                {inv.payments.map((p) => (
                  <p key={p.id} className="flex justify-between text-sm">
                    <span>
                      {formatDate(p.date)} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                    </span>
                    <span className="tabular-nums">{formatMoney(p.amount)}</span>
                  </p>
                ))}
              </div>
            )}

            {canCollect && inv.balance > 0 && (
              <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
                <p className="font-medium">Ghi nhận thu tiền</p>
                <div className="space-y-1">
                  <Label htmlFor="pay-amount">Số tiền (₫)</Label>
                  <Input id="pay-amount" className="min-h-11" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Hình thức</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                      <SelectTrigger className="min-h-11" aria-label="Hình thức">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSFER">Chuyển khoản</SelectItem>
                        <SelectItem value="CASH">Tiền mặt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pay-date">Ngày thu</Label>
                    <Input id="pay-date" type="date" className="min-h-11" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="min-h-11 w-full" disabled={busy || !Number(amount.replace(/\D/g, ""))}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Ghi nhận
                </Button>
              </form>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
