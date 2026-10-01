import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Check, CheckCheck, Inbox, ListTodo, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { errorMessage } from "@/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { type ApprovalItem, type ApprovalType, decideApproval, useApprovals } from "@/api";
import { CODE_LABELS, formatDays } from "@/features/attendance/codes";

const TYPE_META: Record<ApprovalType, { label: string; icon: typeof Inbox }> = {
  LEAVE: { label: "Đơn nghỉ", icon: CalendarOff },
  TASK: { label: "Việc", icon: ListTodo },
};

const keyOf = (item: ApprovalItem) => `${item.type}:${item.id}`;

const codeLabel = (code: string) => CODE_LABELS[code as keyof typeof CODE_LABELS] ?? code;

/** Tiêu đề và các dòng mô tả ngắn của một mục chờ duyệt. */
function describe(item: ApprovalItem, multiSchool: boolean): { title: string; details: { label: string; value: string }[] } {
  const details: { label: string; value: string }[] = [];
  let title = "";
  if (item.leave) {
    const l = item.leave;
    title = `${codeLabel(l.attendanceCode)} (${l.attendanceCode})`;
    details.push(
      { label: "Thời gian", value: l.fromDate === l.toDate ? formatDate(l.fromDate) : `${formatDate(l.fromDate)} – ${formatDate(l.toDate)}` },
      { label: "Số ngày", value: formatDays(l.days) },
      { label: "Lý do", value: l.reason },
    );
  }
  if (item.task) {
    const t = item.task;
    title = t.title;
    if (t.dueAt) details.push({ label: "Hạn", value: formatDateTime(t.dueAt) });
    if (t.checklistTotal) details.push({ label: "Checklist", value: `${t.checklistDone}/${t.checklistTotal}` });
  }
  if (multiSchool && item.schoolName) details.push({ label: "Trường", value: item.schoolName });
  return { title, details };
}

/** Các module bị ảnh hưởng khi duyệt: làm mới để số liệu khớp ngay. */
const AFFECTED = [["approvals"], ["today"], ["leave"], ["attendance"], ["tasks"], ["me"]];

function RejectDialog({ item, onClose, onDone }: { item: ApprovalItem | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await decideApproval(item, false, note);
      await onDone();
      toast.success(item.type === "LEAVE" ? "Đã từ chối đơn nghỉ." : "Đã trả lại việc.");
      setNote("");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.type === "LEAVE" ? "Từ chối đơn nghỉ" : "Trả lại việc"}</DialogTitle>
          <DialogDescription>
            {item && describe(item, false).title} · {item?.requester}
          </DialogDescription>
        </DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lý do (bắt buộc)" rows={3} aria-label="Lý do" />
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant="destructive" className="min-h-11" onClick={submit} disabled={busy || !note.trim()}>
            {item?.type === "LEAVE" ? "Từ chối" : "Trả lại"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hộp duyệt chung: đơn nghỉ và việc chờ duyệt của cơ sở; duyệt có hiệu lực ngay (bảng công, việc). */
export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const query = useApprovals();
  const [tab, setTab] = useState<"ALL" | ApprovalType>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => (query.data ?? []).filter((i) => tab === "ALL" || i.type === tab), [query.data, tab]);
  const counts = useMemo(() => {
    const all = query.data ?? [];
    return { ALL: all.length, LEAVE: all.filter((i) => i.type === "LEAVE").length, TASK: all.filter((i) => i.type === "TASK").length };
  }, [query.data]);
  const chosen = items.filter((i) => selected.has(keyOf(i)));
  const multiSchool = new Set((query.data ?? []).map((i) => i.schoolId)).size > 1;

  const refresh = async () => {
    setSelected(new Set());
    await Promise.all(AFFECTED.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };

  const approve = async (item: ApprovalItem) => {
    setBusy(keyOf(item));
    try {
      await decideApproval(item, true);
      await refresh();
      toast.success(item.type === "LEAVE" ? "Đã duyệt đơn nghỉ, bảng công đã cập nhật." : "Đã duyệt hoàn thành việc.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const approveMany = async () => {
    const results = await Promise.allSettled(chosen.map((item) => decideApproval(item, true)));
    const failed = results.filter((r) => r.status === "rejected").length;
    await refresh();
    if (failed) toast.warning(`Đã duyệt ${results.length - failed} mục, ${failed} mục không duyệt được.`);
    else toast.success(`Đã duyệt ${results.length} mục.`);
  };

  const toggle = (item: ApprovalItem, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(keyOf(item));
    else next.delete(keyOf(item));
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hộp duyệt"
        description="Mọi việc đang chờ ban giám hiệu quyết định."
        actions={
          chosen.length > 0 && (
            <Button className="min-h-11" onClick={() => setConfirmBulk(true)}>
              <CheckCheck className="w-4 h-4 mr-2" /> Duyệt {chosen.length} mục
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setSelected(new Set()); }}>
        <TabsList>
          <TabsTrigger value="ALL" className="min-h-9">Tất cả ({counts.ALL})</TabsTrigger>
          <TabsTrigger value="LEAVE" className="min-h-9">Đơn nghỉ ({counts.LEAVE})</TabsTrigger>
          <TabsTrigger value="TASK" className="min-h-9">Việc ({counts.TASK})</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Inbox} title="Không có mục nào chờ duyệt" description="Đơn nghỉ và việc hoàn thành cần duyệt sẽ hiện ở đây." />
      ) : (
        <>
          <label className="flex min-h-11 w-fit items-center gap-2 text-sm">
            <Checkbox
              checked={chosen.length === items.length}
              onCheckedChange={(c) => setSelected(c === true ? new Set(items.map(keyOf)) : new Set())}
              aria-label="Chọn tất cả"
            />
            Chọn tất cả
          </label>
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = TYPE_META[item.type].icon;
              const key = keyOf(item);
              const { title, details } = describe(item, multiSchool);
              return (
                <li key={key}>
                  <Card>
                    <CardContent className="flex gap-3 p-4">
                      <Checkbox className="mt-1" checked={selected.has(key)} onCheckedChange={(c) => toggle(item, c === true)} aria-label={`Chọn ${title}`} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <Icon className="w-3 h-3" /> {TYPE_META[item.type].label}
                          </Badge>
                          <span className="font-semibold">{title}</span>
                        </div>
                        <p className="text-sm">
                          <span className="font-medium">{item.requester}</span>
                          <span className="text-muted-foreground"> · {formatDateTime(item.createdAt)}</span>
                        </p>
                        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                          {details.map((d) => (
                            <div key={d.label} className="contents">
                              <dt className="text-muted-foreground">{d.label}</dt>
                              <dd className="min-w-0 break-words">{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button className="min-h-11" onClick={() => approve(item)} disabled={busy === key}>
                            <Check className="w-4 h-4 mr-2" /> Duyệt
                          </Button>
                          <Button variant="outline" className="min-h-11" onClick={() => setRejecting(item)} disabled={busy === key}>
                            <X className="w-4 h-4 mr-2" /> {item.type === "LEAVE" ? "Từ chối" : "Trả lại"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <RejectDialog item={rejecting} onClose={() => setRejecting(null)} onDone={refresh} />
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        onConfirm={approveMany}
        title={`Duyệt ${chosen.length} mục?`}
        description="Đơn nghỉ được ghi vào bảng công, việc được đánh dấu hoàn thành."
        confirmText="Duyệt"
      />
    </div>
  );
}
