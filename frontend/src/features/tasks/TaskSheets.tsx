import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/common/FormSheet";
import { StatusBadge } from "@/components/common/StatusBadge";
import { errorMessage } from "@/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { addComment, changeStatus, PRIORITY, saveTask, TASK_COLUMNS, type TaskFields, type TaskItem, toggleChecklist, useAssignees } from "@/api";

const schema = z.object({
  title: z.string().trim().min(3, "Nhập tên việc (ít nhất 3 ký tự)."),
  description: z.string().trim().max(2000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().min(1, "Chọn hạn hoàn thành."),
  assigneeIds: z.array(z.string()).min(1, "Chọn ít nhất một người nhận."),
  checklist: z.string().max(2000),
});
type Values = z.infer<typeof schema>;

const toValues = (task?: TaskItem | null): Values => ({
  title: task?.title ?? "",
  description: task?.description ?? "",
  priority: task?.priority ?? "MEDIUM",
  dueDate: task?.dueDate ?? "",
  assigneeIds: task?.assignees.map((a) => a.id) ?? [],
  checklist: "",
});

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all(["tasks", "today", "approvals"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

/** Giao việc mới / sửa việc (ban giám hiệu). */
export function TaskFormSheet({ open, onOpenChange, task }: { open: boolean; onOpenChange: (o: boolean) => void; task?: TaskItem | null }) {
  const queryClient = useQueryClient();
  const assignees = useAssignees();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(task) });
  useEffect(() => {
    if (open) form.reset(toValues(task));
  }, [open, task, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Sửa việc" : "Giao việc"}
      form={form}
      successMessage={task ? "Đã lưu việc." : "Đã giao việc, người nhận sẽ được thông báo."}
      submitLabel={task ? "Lưu" : "Giao việc"}
      onSubmit={async (v) => {
        await saveTask(task?.id ?? null, { ...v, checklist: v.checklist.split("\n").filter((l) => l.trim()) } as TaskFields);
        await invalidate(queryClient);
      }}
    >
      <TextField form={form} name="title" label="Tên việc" required />
      <TextAreaField form={form} name="description" label="Mô tả" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField form={form} name="priority" label="Ưu tiên" required options={Object.entries(PRIORITY).map(([value, m]) => ({ value, label: m.label }))} />
        <TextField form={form} name="dueDate" label="Hạn" type="date" required />
      </div>
      <FormField
        control={form.control}
        name="assigneeIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Người nhận<span className="text-destructive ml-0.5">*</span>
            </FormLabel>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
              {(assignees.data ?? []).map((s) => {
                const checked = field.value.includes(s.id);
                return (
                  <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
                    <Checkbox checked={checked} onCheckedChange={(c) => field.onChange(c === true ? [...field.value, s.id] : field.value.filter((id) => id !== s.id))} />
                    <span className="flex-1 text-sm">{s.fullName}</span>
                    <span className="text-xs text-muted-foreground">{s.position}</span>
                  </label>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      {!task && (
        <FormField
          control={form.control}
          name="checklist"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Checklist (mỗi dòng một mục)</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} placeholder={"Chuẩn bị vật tư\nChụp ảnh gửi nhóm BGH"} />
              </FormControl>
            </FormItem>
          )}
        />
      )}
    </FormSheet>
  );
}

/** Chi tiết việc: checklist, bình luận, đổi trạng thái. */
export function TaskDetailSheet({ task, onClose, onEdit }: { task: TaskItem | null; onClose: () => void; onEdit: (t: TaskItem) => void }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      await invalidate(queryClient);
      if (success) toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {task && (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle className="pr-6">{task.title}</SheetTitle>
              <SheetDescription>
                Giao bởi {task.createdByName} · {formatDateTime(task.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={task.priority} labels={PRIORITY} />
              <span className={cn(task.overdue && "font-medium text-destructive")}>
                Hạn {formatDate(task.dueDate)}
                {task.overdue && " · quá hạn"}
              </span>
              {task.canEdit && (
                <Button variant="ghost" size="sm" className="ml-auto min-h-9" onClick={() => onEdit(task)}>
                  <Pencil className="w-4 h-4 mr-1" /> Sửa
                </Button>
              )}
            </div>
            {task.description && <p className="whitespace-pre-line text-sm">{task.description}</p>}
            <p className="text-sm">
              <span className="text-muted-foreground">Người nhận: </span>
              {task.assignees.map((a) => a.fullName).join(", ")}
            </p>

            {task.allowedStatuses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Chuyển trạng thái</p>
                <div className="flex flex-wrap gap-2">
                  {TASK_COLUMNS.filter((c) => task.allowedStatuses.includes(c.status)).map((c) => (
                    <Button key={c.status} variant={c.status === "DONE" || c.status === "WAITING_APPROVAL" ? "default" : "outline"} className="min-h-11" disabled={busy} onClick={() => run(() => changeStatus(task.id, c.status), `Đã chuyển sang "${c.label}".`)}>
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {task.checklist.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Checklist ({task.checklist.filter((c) => c.done).length}/{task.checklist.length})
                </p>
                {task.checklist.map((item) => (
                  <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
                    <Checkbox checked={item.done} disabled={busy || task.status === "DONE"} onCheckedChange={(c) => run(() => toggleChecklist(task.id, item.id, c === true))} />
                    <span className={cn("text-sm", item.done && "text-muted-foreground line-through")}>{item.content}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Trao đổi</p>
              {task.comments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bình luận.</p>}
              <ul className="space-y-2">
                {task.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-muted p-3 text-sm">
                    <p>
                      <span className="font-medium">{c.author}</span> <span className="text-xs text-muted-foreground">{formatDateTime(c.at)}</span>
                    </p>
                    <p className="whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) run(() => addComment(task.id, comment).then(() => setComment("")));
                }}
              >
                <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Viết bình luận…" aria-label="Bình luận" />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={busy || !comment.trim()} aria-label="Gửi bình luận">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
