import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Check, ChevronLeft, ChevronRight, Loader2, Paperclip, Plus, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError, errorMessage } from "@/api";
import type { StoredFile } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FilePreviewDialog, type PreviewFile } from "@/components/common/FilePreviewDialog";
import { FileUpload } from "@/components/common/FileUpload";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useCan } from "@/hooks/useCan";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDateTime } from "@/lib/format";
import { SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { CODE_LABELS, currentMonth, formatDays, monthLabel, shiftMonth } from "@/features/attendance/codes";
import {
  approveLeaveRequest,
  approveLeaveRequests,
  cancelLeaveRequest,
  createLeaveRequest,
  LEAVE_CODES,
  LEAVE_STATUS,
  type LeaveRequestDto,
  leaveFileUrl,
  leaveRange,
  rejectLeaveRequest,
  useLeaveCalendar,
  useMyLeaveBalance,
  useMyLeaveRequests,
  usePendingLeaves,
} from "@/api";
import { MonthCalendar } from "@/features/attendance/MonthCalendar";

// ---- xin nghỉ

const requestSchema = z
  .object({
    leaveCode: z.enum(LEAVE_CODES, { required_error: "Chọn loại nghỉ" }),
    fromDate: z.string().min(1, "Chọn ngày bắt đầu"),
    toDate: z.string().min(1, "Chọn ngày kết thúc"),
    halfDay: z.boolean().default(false),
    reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(500),
    file: z.custom<StoredFile | null>().default(null),
  })
  .refine((v) => v.toDate >= v.fromDate, { path: ["toDate"], message: "Đến ngày phải sau từ ngày" });
type RequestValues = z.infer<typeof requestSchema>;

function RequestSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const empty = (): RequestValues => ({
    leaveCode: "P",
    fromDate: "",
    toDate: "",
    halfDay: false,
    reason: "",
    file: null,
  });
  const form = useForm<RequestValues>({ resolver: zodResolver(requestSchema), defaultValues: empty() });
  useEffect(() => {
    if (open) form.reset(empty());
  }, [open, form]);
  const [code, from, to] = form.watch(["leaveCode", "fromDate", "toDate"]);
  const halfDayAllowed = (code === "P" || code === "K") && !!from && from === to;
  useEffect(() => {
    if (!halfDayAllowed) form.setValue("halfDay", false);
  }, [halfDayAllowed, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Xin nghỉ"
      description="Đơn được gửi tới hiệu trưởng; duyệt xong mã nghỉ tự ghi vào bảng công."
      form={form}
      submitLabel="Gửi đơn"
      successMessage="Đã gửi đơn xin nghỉ."
      onSubmit={async (v) => {
        await createLeaveRequest({
          leaveCode: v.leaveCode,
          fromDate: v.fromDate,
          toDate: v.toDate,
          halfDay: halfDayAllowed && v.halfDay,
          reason: v.reason,
          fileId: v.file?.id,
        });
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        await queryClient.invalidateQueries({ queryKey: ["leave"] });
      }}
    >
      <SelectField
        form={form}
        name="leaveCode"
        label="Loại nghỉ"
        required
        options={LEAVE_CODES.map((c) => ({ value: c, label: `${c} – ${CODE_LABELS[c]}` }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="fromDate" label="Từ ngày" type="date" required />
        <TextField form={form} name="toDate" label="Đến ngày" type="date" required />
      </div>
      {halfDayAllowed && (
        <FormField
          control={form.control}
          name="halfDay"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0 min-h-11">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
              </FormControl>
              <FormLabel className="font-normal">Chỉ nghỉ nửa ngày ({code === "P" ? "1/2P" : "1/2K"})</FormLabel>
            </FormItem>
          )}
        />
      )}
      <TextAreaField form={form} name="reason" label="Lý do" required />
      <FormField
        control={form.control}
        name="file"
        render={({ field }) => (
          <FormItem>
            <FileUpload label="Giấy tờ kèm theo (giấy khám bệnh…)" value={field.value} onChange={field.onChange} />
            <FormMessage />
          </FormItem>
        )}
      />
    </FormSheet>
  );
}

function RequestCard({
  r,
  selectable,
  selected,
  onSelect,
  actions,
  onPreview,
}: {
  r: LeaveRequestDto;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  actions?: ReactNode;
  onPreview: (r: LeaveRequestDto) => void;
}) {
  return (
    <li className="rounded-lg border p-3" data-testid="leave-card">
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox
            className="mt-1 h-5 w-5"
            checked={selected}
            onCheckedChange={(c) => onSelect?.(c === true)}
            aria-label={`Chọn đơn của ${r.staffName} ${leaveRange(r.fromDate, r.toDate)}`}
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{r.attendanceCode}</span>
            <span className="text-sm">{CODE_LABELS[r.attendanceCode as keyof typeof CODE_LABELS]}</span>
            <StatusBadge status={r.status} labels={LEAVE_STATUS} />
          </div>
          {selectable && <p className="text-sm font-medium">{r.staffName}</p>}
          <p className="text-sm">
            {leaveRange(r.fromDate, r.toDate)} · {formatDays(r.days)} ngày
          </p>
          <p className="text-sm text-muted-foreground">{r.reason}</p>
          {r.file && (
            <button type="button" className="inline-flex items-center gap-1 text-sm text-primary hover:underline min-h-11" onClick={() => onPreview(r)}>
              <Paperclip className="w-3.5 h-3.5" /> {r.file.originalName}
            </button>
          )}
          {r.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              {r.reviewerName ?? "Người duyệt"} · {formatDateTime(r.reviewedAt)}
              {r.reviewNote ? `: ${r.reviewNote}` : ""}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="mt-2 flex flex-wrap justify-end gap-2">{actions}</div>}
    </li>
  );
}

function MyRequestsTab({ onPreview }: { onPreview: (r: LeaveRequestDto) => void }) {
  const queryClient = useQueryClient();
  const requests = useMyLeaveRequests();
  const balance = useMyLeaveBalance();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequestDto | null>(null);

  if (requests.isError && requests.error instanceof ApiError && requests.error.status === 404) {
    return <EmptyState icon={UserX} title="Tài khoản chưa gắn hồ sơ nhân viên" description="Liên hệ văn phòng điều hành để gắn hồ sơ trước khi xin nghỉ." />;
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
          {balance.data ? (
            <div data-testid="leave-balance">
              <p className="text-sm text-muted-foreground">Phép năm {balance.data.year}</p>
              <p className="text-2xl font-bold">
                Còn {formatDays(balance.data.remaining)}
                <span className="text-base font-normal text-muted-foreground"> / {formatDays(balance.data.annualDays)} ngày</span>
              </p>
              {balance.data.pendingDays > 0 && (
                <p className="text-sm text-amber-700">Đang chờ duyệt {formatDays(balance.data.pendingDays)} ngày</p>
              )}
            </div>
          ) : balance.isLoading ? (
            <div className="h-14" />
          ) : (
            <p className="text-sm text-muted-foreground">Chưa xem được phép năm.</p>
          )}
          <Button className="min-h-11 w-full sm:w-auto" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" /> Xin nghỉ
          </Button>
        </CardContent>
      </Card>
      {requests.isLoading ? (
        <TableSkeleton rows={3} columns={2} />
      ) : requests.isError ? (
        <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
      ) : !requests.data?.length ? (
        <EmptyState icon={CalendarOff} title="Chưa có đơn nghỉ" description="Bấm “Xin nghỉ” để gửi đơn." />
      ) : (
        <ul className="space-y-2" aria-label="Đơn của tôi">
          {requests.data.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              onPreview={onPreview}
              actions={
                r.canCancel && (
                  <Button variant="outline" className="min-h-11" onClick={() => setCancelling(r)}>
                    Hủy đơn
                  </Button>
                )
              }
            />
          ))}
        </ul>
      )}
      <RequestSheet open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Hủy đơn xin nghỉ?"
        description={cancelling ? `${cancelling.attendanceCode} · ${leaveRange(cancelling.fromDate, cancelling.toDate)}` : undefined}
        confirmText="Hủy đơn"
        cancelText="Không"
        variant="destructive"
        onConfirm={async () => {
          await cancelLeaveRequest(cancelling!.id);
          toast.success("Đã hủy đơn.");
          await queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      />
    </div>
  );
}

// ---- chờ duyệt

const rejectSchema = z.object({ note: z.string().trim().min(1, "Vui lòng nhập lý do từ chối").max(500) });

function PendingTab({ onPreview }: { onPreview: (r: LeaveRequestDto) => void }) {
  const queryClient = useQueryClient();
  const pending = usePendingLeaves(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveRequestDto | null>(null);
  const rejectForm = useForm<z.infer<typeof rejectSchema>>({ resolver: zodResolver(rejectSchema), defaultValues: { note: "" } });
  useEffect(() => {
    if (rejecting) rejectForm.reset({ note: "" });
  }, [rejecting, rejectForm]);
  const items = useMemo(() => (pending.data?.items ?? []).filter((r) => r.canReview), [pending.data]);

  const refresh = async () => {
    setSelected(new Set());
    await queryClient.invalidateQueries({ queryKey: ["leave"] });
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
  };

  const approve = async (ids: string[]) => {
    setBusy(true);
    try {
      if (ids.length === 1) {
        await approveLeaveRequest(ids[0]);
        toast.success("Đã duyệt đơn, bảng công đã cập nhật.");
      } else {
        const result = await approveLeaveRequests(ids);
        if (result.failed.length > 0) {
          toast.warning(`Đã duyệt ${result.approved} đơn; ${result.failed.length} đơn lỗi: ${result.failed[0].message}`);
        } else {
          toast.success(`Đã duyệt ${result.approved} đơn, bảng công đã cập nhật.`);
        }
      }
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (pending.isLoading) return <TableSkeleton rows={3} columns={2} />;
  if (pending.isError) return <ErrorState error={pending.error} onRetry={() => pending.refetch()} />;
  if (items.length === 0) return <EmptyState icon={Check} title="Không có đơn chờ duyệt" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm min-h-11">
          <Checkbox
            checked={selected.size === items.length}
            onCheckedChange={(c) => setSelected(c === true ? new Set(items.map((r) => r.id)) : new Set())}
          />
          Chọn tất cả
        </label>
        <Button className="min-h-11 ml-auto" disabled={selected.size === 0 || busy} onClick={() => approve([...selected])}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Duyệt đã chọn ({selected.size})
        </Button>
      </div>
      <ul className="space-y-2" aria-label="Đơn chờ duyệt">
        {items.map((r) => (
          <RequestCard
            key={r.id}
            r={r}
            selectable
            selected={selected.has(r.id)}
            onSelect={(checked) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (checked) next.add(r.id);
                else next.delete(r.id);
                return next;
              })
            }
            onPreview={onPreview}
            actions={
              <>
                <Button variant="outline" className="min-h-11" onClick={() => setRejecting(r)} disabled={busy}>
                  <X className="w-4 h-4 mr-1" /> Từ chối
                </Button>
                <Button className="min-h-11" onClick={() => approve([r.id])} disabled={busy} aria-label={`Duyệt đơn của ${r.staffName} ${leaveRange(r.fromDate, r.toDate)}`}>
                  <Check className="w-4 h-4 mr-1" /> Duyệt
                </Button>
              </>
            }
          />
        ))}
      </ul>
      <FormSheet
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Từ chối đơn nghỉ"
        description={rejecting ? `${rejecting.staffName} · ${rejecting.attendanceCode} · ${leaveRange(rejecting.fromDate, rejecting.toDate)}` : undefined}
        form={rejectForm}
        submitLabel="Từ chối"
        successMessage="Đã từ chối đơn."
        onSubmit={async ({ note }) => {
          await rejectLeaveRequest(rejecting!.id, note);
          await refresh();
        }}
      >
        <TextAreaField form={rejectForm} name="note" label="Lý do" required />
      </FormSheet>
    </div>
  );
}

// ---- lịch nghỉ

function CalendarTab() {
  const [month, setMonth] = useState(currentMonth());
  const calendar = useLeaveCalendar(month, true);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="min-w-[8.5rem] text-center font-medium">{monthLabel(month)}</span>
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      {calendar.isError ? (
        <ErrorState error={calendar.error} onRetry={() => calendar.refetch()} />
      ) : (
        <MonthCalendar
          month={month}
          label="Lịch nghỉ"
          renderDay={(date) =>
            (calendar.data ?? [])
              .filter((e) => e.fromDate <= date && e.toDate >= date)
              .map((e) => (
                <p key={e.requestId} className="truncate text-[0.7rem]" title={`${e.staffName} – ${e.attendanceCode}`}>
                  <b>{e.attendanceCode}</b> {e.staffName}
                </p>
              ))
          }
        />
      )}
    </div>
  );
}

/** Nghỉ phép: đơn của tôi (mọi người), chờ duyệt (hiệu trưởng, văn phòng điều hành), lịch nghỉ của cơ sở. */
export default function LeavePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canApprove = useCan("approve", "attendance");
  const canView = useCan("view", "attendance");
  const { isAllSchools, canChooseAll } = useCurrentSchool();
  const [preview, setPreview] = useState<{ id: string; file: PreviewFile } | null>(null);
  const tabs = [
    { value: "cua-toi", label: "Đơn của tôi", show: true },
    { value: "cho-duyet", label: "Chờ duyệt", show: canApprove },
    { value: "lich", label: "Lịch nghỉ", show: canView && !(canChooseAll && isAllSchools) },
  ].filter((t) => t.show);
  const tabParam = searchParams.get("tab");
  const tab = tabs.some((t) => t.value === tabParam) ? tabParam! : "cua-toi";
  const onPreview = (r: LeaveRequestDto) => r.file && setPreview({ id: r.id, file: r.file });

  return (
    <div>
      <PageHeader title="Nghỉ phép" description="Xin nghỉ theo mã công; duyệt xong mã tự ghi vào bảng công và trừ phép năm." />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
      >
        {tabs.length > 1 && (
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="min-h-9">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <TabsContent value="cua-toi" className="mt-4">
          <MyRequestsTab onPreview={onPreview} />
        </TabsContent>
        {canApprove && (
          <TabsContent value="cho-duyet" className="mt-4">
            <PendingTab onPreview={onPreview} />
          </TabsContent>
        )}
        {tabs.some((t) => t.value === "lich") && (
          <TabsContent value="lich" className="mt-4">
            <CalendarTab />
          </TabsContent>
        )}
      </Tabs>
      <FilePreviewDialog file={preview?.file ?? null} loadUrl={() => leaveFileUrl(preview!.id)} onClose={() => setPreview(null)} />
    </div>
  );
}
