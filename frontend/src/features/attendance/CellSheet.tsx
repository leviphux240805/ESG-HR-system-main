import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import { updateAttendanceCell } from "@/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSheet } from "@/components/common/FormSheet";
import { ErrorState } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { type CellDetail, useCellDetail } from "@/api";
import { ATTENDANCE_CODES, CODE_LABELS } from "./codes";

const NONE = "__none__";
const time = z.string().refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "Giờ dạng HH:mm").default("");
const schema = z.object({
  code: z.string().default(NONE),
  note: z.string().trim().max(500).default(""),
  leaveTime: time,
  returnTime: time,
});
type Values = z.infer<typeof schema>;

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : "");
const SOURCE_LABELS: Record<string, string> = { MANUAL: "chấm tay", MACHINE: "tự điền từ máy", LEAVE: "từ đơn nghỉ" };

function MachineInfo({ detail, onUseSuggestion }: { detail: CellDetail; onUseSuggestion?: (code: string) => void }) {
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p>
        Máy chấm công: <b>{detail.checkIn ?? "—"}</b> → <b>{detail.checkOut ?? "—"}</b>
        {detail.lateMinutes > 0 && (
          <span className="ml-2 text-muted-foreground">
            muộn {detail.lateMinutes} phút{detail.countedLate ? " (tính muộn)" : ""}
          </span>
        )}
      </p>
      {detail.code && detail.source && (
        <p className="text-muted-foreground">
          Mã hiện tại: {detail.code} ({SOURCE_LABELS[detail.source] ?? detail.source})
        </p>
      )}
      {detail.discrepancy && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-amber-50 p-2 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{detail.discrepancyReason}</span>
          {detail.suggestedStatus && onUseSuggestion && (
            <Button type="button" size="sm" variant="outline" className="min-h-9" onClick={() => onUseSuggestion(detail.suggestedStatus!)}>
              Dùng gợi ý {detail.suggestedStatus}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  target: { staffId: string; date: string } | null;
  editable: boolean;
  onClose: () => void;
}

/** Sửa một ô bảng công (thay AttendanceCellEditModal của ESG); tháng đã khóa hoặc không có quyền thì chỉ xem. */
export function CellSheet({ target, editable, onClose }: Props) {
  const queryClient = useQueryClient();
  const detail = useCellDetail(target?.staffId, target?.date);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: NONE, note: "", leaveTime: "", returnTime: "" } });
  const d = detail.data;
  useEffect(() => {
    if (d) form.reset({ code: d.code ?? NONE, note: d.note ?? "", leaveTime: hhmm(d.leaveTime), returnTime: hhmm(d.returnTime) });
  }, [d, form]);

  const title = d ? `${d.fullName} – ${formatDate(d.date)}` : "Chấm công";
  const canEdit = editable && d && !d.locked;

  if (!target) return null;
  if (!canEdit) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{d?.locked ? "Công tháng đã khóa, chỉ xem." : "Chỉ xem."}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {detail.isLoading ? (
              <Skeleton className="h-24" />
            ) : detail.isError ? (
              <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
            ) : d ? (
              <>
                <p className="text-lg font-semibold">
                  {d.code ?? "Chưa chấm"} {d.code && <span className="text-sm font-normal text-muted-foreground">{CODE_LABELS[d.code as keyof typeof CODE_LABELS]}</span>}
                </p>
                <MachineInfo detail={d} />
                {d.note && <p className="text-sm">Ghi chú: {d.note}</p>}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <FormSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      form={form}
      successMessage="Đã lưu chấm công."
      onSubmit={async (v) => {
        await updateAttendanceCell(target.staffId, target.date, {
          code: v.code === NONE ? undefined : v.code,
          note: v.note || undefined,
          leaveTime: v.leaveTime || undefined,
          returnTime: v.returnTime || undefined,
        });
        await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      }}
    >
      <MachineInfo detail={d} onUseSuggestion={(code) => form.setValue("code", code, { shouldDirty: true })} />
      <SelectField
        form={form}
        name="code"
        label="Mã công"
        options={[{ value: NONE, label: "— Chưa chấm —" }, ...ATTENDANCE_CODES.map((c) => ({ value: c, label: `${c} – ${CODE_LABELS[c]}` }))]}
      />
      <div className="grid gap-4 grid-cols-2">
        <TextField form={form} name="leaveTime" label="Giờ ra giữa ca" type="time" />
        <TextField form={form} name="returnTime" label="Giờ vào lại" type="time" />
      </div>
      <TextAreaField form={form} name="note" label="Ghi chú" />
    </FormSheet>
  );
}
