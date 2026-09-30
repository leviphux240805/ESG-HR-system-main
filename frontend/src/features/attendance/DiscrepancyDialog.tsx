import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveDiscrepancies } from "@/api";
import { errorMessage } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { useDiscrepancies } from "@/api";
import { ATTENDANCE_CODES, CODE_LABELS, monthLabel } from "./codes";

const key = (staffId: string, date: string) => `${staffId}|${date}`;

/**
 * Xử lý sai lệch hàng loạt (thay DiscrepancyReviewModal của ESG): mỗi ngày chọn mã (mặc định: gợi ý của đối soát,
 * không có thì mã hiện tại, không có nữa thì X), "Xác nhận tất cả" ghi mã và bỏ cờ sai lệch.
 */
export function DiscrepancyDialog({ open, onOpenChange, month }: { open: boolean; onOpenChange: (open: boolean) => void; month: string }) {
  const queryClient = useQueryClient();
  const list = useDiscrepancies(month, open);
  const [choices, setChoices] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (list.data) {
      setChoices(new Map(list.data.map((d) => [key(d.staffId, d.date), d.suggestedStatus ?? d.code ?? "X"])));
    }
  }, [list.data]);

  const saveAll = async () => {
    if (!list.data?.length) return;
    setSaving(true);
    try {
      await resolveDiscrepancies({
        month,
        items: list.data.map((d) => ({ staffId: d.staffId, date: d.date, code: choices.get(key(d.staffId, d.date)) ?? "X" })),
      });
      toast.success(`Đã xác nhận ${list.data.length} ngày sai lệch.`);
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const count = list.data?.length ?? 0;
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Xử lý sai lệch chấm công</DialogTitle>
          <DialogDescription>
            {monthLabel(month)} – {count} ngày cần xác nhận
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {list.isLoading ? (
            <Skeleton className="h-40" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : count === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
              <p className="mt-2 font-medium">Không có sai lệch</p>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Ngày sai lệch">
              {list.data!.map((d) => {
                const k = key(d.staffId, d.date);
                return (
                  <li key={k} className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">
                        {d.fullName} <span className="text-muted-foreground font-normal">({d.staffCode})</span> · {formatDate(d.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Máy: {d.checkIn ?? "—"} → {d.checkOut ?? "—"} · Hiện tại: {d.code ?? "chưa chấm"}
                      </p>
                      <p className="text-xs text-amber-800">{d.reason}</p>
                    </div>
                    <Select value={choices.get(k) ?? "X"} onValueChange={(v) => setChoices((prev) => new Map(prev).set(k, v))}>
                      <SelectTrigger className="w-40 min-h-11" aria-label={`Mã cho ${d.fullName} ngày ${formatDate(d.date)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_CODES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c} – {CODE_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button className="min-h-11" onClick={saveAll} disabled={saving || count === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Xác nhận tất cả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
