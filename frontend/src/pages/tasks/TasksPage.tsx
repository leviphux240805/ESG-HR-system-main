import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { errorMessage } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StaffAvatar } from "@/features/staff/StaffAvatar";
import { changeStatus, PRIORITY, TASK_COLUMNS, type TaskItem, type TaskPriority, type TaskStatus, useTasks } from "@/api";
import { TaskDetailSheet, TaskFormSheet } from "@/features/tasks/TaskSheets";

const ALL = "ALL";

function TaskCard({ task, onOpen }: { task: TaskItem; onOpen: () => void }) {
  const draggable = task.allowedStatuses.length > 0;
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onOpen}
      className={cn(
        "w-full space-y-2 rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        task.overdue && "border-destructive/60",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{task.title}</p>
        <StatusBadge status={task.priority} labels={PRIORITY} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className={cn("flex items-center gap-1", task.overdue && "font-medium text-destructive")}>
          <CalendarClock className="w-3.5 h-3.5" /> {task.dueAt ? formatDate(task.dueAt) : "Không hạn"}
          {task.overdue && " · quá hạn"}
        </span>
        {task.checklistTotal > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5" /> {task.checklistDone}/{task.checklistTotal}
          </span>
        )}
        {task.schoolName && <span>{task.schoolName}</span>}
      </div>
      <div className="flex -space-x-2">
        {task.assignees.map((a) => (
          <StaffAvatar key={a.staffId} fullName={a.fullName} className="h-7 w-7 border-2 border-card text-[10px]" />
        ))}
      </div>
    </button>
  );
}

/** Công việc dạng Kanban: kéo thả thẻ giữa các cột (máy tính) hoặc mở thẻ để chuyển trạng thái (điện thoại). */
export default function TasksPage() {
  const queryClient = useQueryClient();
  const canAssign = useCan("manage", "tasks");
  const myStaffId = useAuth().me?.staffId;
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState(ALL);
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const debounced = useDebouncedValue(q, 300);
  const query = useTasks({
    q: debounced || undefined,
    priority: priority === ALL ? undefined : (priority as TaskPriority),
    assigneeStaffId: mine ? myStaffId : undefined,
    overdue,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskItem | null | undefined>(undefined);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  // Điện thoại: một cột theo tab trạng thái thay cho bảng 4 cột
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("IN_PROGRESS");

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskItem[]>(TASK_COLUMNS.map((c) => [c.status, []]));
    for (const t of query.data ?? []) map.get(t.status)?.push(t);
    return map;
  }, [query.data]);

  const drop = async (status: TaskStatus, id: string) => {
    setDragOver(null);
    const task = query.data?.find((t) => t.id === id);
    if (!task || task.status === status) return;
    if (!task.allowedStatuses.includes(status)) return void toast.error("Chỉ người giao việc được chuyển sang Hoàn thành.");
    try {
      await changeStatus(id, status);
      await Promise.all(["tasks", "today", "approvals"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Công việc"
        description={canAssign ? "Giao việc, theo dõi tiến độ và duyệt hoàn thành." : "Việc được giao cho bạn."}
        actions={
          canAssign && (
            <Button className="min-h-11" onClick={() => setEditing(null)}>
              <Plus className="w-4 h-4 mr-2" /> Giao việc
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="min-h-11 pl-9" placeholder="Tìm theo tên việc" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm việc" />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="min-h-11 w-40" aria-label="Ưu tiên">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi mức ưu tiên</SelectItem>
            {Object.entries(PRIORITY).map(([value, m]) => (
              <SelectItem key={value} value={value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canAssign && myStaffId && (
          <Toggle variant="outline" className="min-h-11" pressed={mine} onPressedChange={setMine}>
            Việc của tôi
          </Toggle>
        )}
        <Toggle variant="outline" className="min-h-11" pressed={overdue} onPressedChange={setOverdue}>
          Quá hạn
        </Toggle>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Trạng thái">
            {TASK_COLUMNS.map((col) => (
              <button
                key={col.status}
                type="button"
                role="tab"
                aria-selected={mobileStatus === col.status}
                onClick={() => setMobileStatus(col.status)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-lg text-xs font-medium leading-tight transition-colors",
                  mobileStatus === col.status ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                {col.label}
                <span className="tabular-nums">{byStatus.get(col.status)!.length}</span>
              </button>
            ))}
          </div>
          {byStatus.get(mobileStatus)!.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={() => setOpenId(t.id)} />
          ))}
          {byStatus.get(mobileStatus)!.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Không có việc</p>}
        </div>
        <div className="hidden overflow-x-auto pb-2 md:block">
          <div className="grid min-w-[56rem] grid-cols-4 gap-3">
            {TASK_COLUMNS.map((col) => {
              const items = byStatus.get(col.status)!;
              return (
                <section
                  key={col.status}
                  aria-label={col.label}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(col.status);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(col.status, e.dataTransfer.getData("text/plain"));
                  }}
                  className={cn("min-h-[16rem] space-y-2 rounded-xl bg-muted/60 p-2 transition-colors", dragOver === col.status && "bg-secondary ring-2 ring-primary")}
                >
                  <h2 className="flex items-center justify-between px-1 py-1 text-sm font-semibold">
                    {col.label}
                    <span className="rounded-full bg-background px-2 text-xs font-medium text-muted-foreground">{items.length}</span>
                  </h2>
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => setOpenId(t.id)} />
                  ))}
                  {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Không có việc</p>}
                </section>
              );
            })}
          </div>
        </div>
        </>
      )}

      <TaskDetailSheet
        taskId={openId}
        onClose={() => setOpenId(null)}
        onEdit={(t) => {
          setOpenId(null);
          setEditing(t);
        }}
      />
      <TaskFormSheet open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} task={editing} />
    </div>
  );
}
