import type { components } from "@/api/schema";
import { db, type TaskRec, type TaskStatus } from "../db";
import { type Ctx, MockError, matches, newId, notFound, nowIso, on, paginate, requireBgh } from "../router";
import { notify, schoolStaff, staffName, today } from "./common";

type S = components["schemas"];

// Bản demo của TaskService: BGH giao và chuyển tự do; người nhận chỉ tới "Chờ duyệt".

const ALL: TaskStatus[] = ["NEW", "IN_PROGRESS", "WAITING_APPROVAL", "DONE", "CANCELLED"];
const LABEL: Record<TaskStatus, string> = { NEW: "Mới", IN_PROGRESS: "Đang làm", WAITING_APPROVAL: "Chờ duyệt", DONE: "Hoàn thành", CANCELLED: "Đã hủy" };

/** Hạn lưu theo ngày; API trả thời điểm cuối ngày giờ Việt Nam. */
const dueAt = (date: string) => `${date}T16:59:00Z`;
const vnDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

function allowed(task: TaskRec, ctx: Ctx): TaskStatus[] {
  if (ctx.user.isBgh) return ALL.filter((s) => s !== task.status);
  if (!task.assigneeIds.includes(ctx.user.staff.id) || task.status === "DONE" || task.status === "CANCELLED") return [];
  return (["NEW", "IN_PROGRESS", "WAITING_APPROVAL"] as TaskStatus[]).filter((s) => s !== task.status);
}

function toItem(t: TaskRec, ctx: Ctx): S["TaskItem"] {
  return {
    id: t.id,
    schoolId: t.schoolId,
    schoolName: db().schools.find((s) => s.id === t.schoolId)?.name,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueAt: dueAt(t.dueDate),
    overdue: t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate < today(),
    assignees: t.assigneeIds.map((id) => ({ staffId: id, fullName: staffName(id), done: t.status === "DONE" })),
    checklistDone: t.checklist.filter((c) => c.done).length,
    checklistTotal: t.checklist.length,
    template: false,
    createdByName: staffName(t.createdById),
    createdAt: t.createdAt,
    canEdit: ctx.user.isBgh,
    allowedStatuses: allowed(t, ctx),
  };
}

function toDetail(t: TaskRec, ctx: Ctx): S["TaskDetail"] {
  return {
    task: toItem(t, ctx),
    description: t.description || undefined,
    assignee: t.assigneeIds.includes(ctx.user.staff.id),
    checklist: t.checklist,
    comments: t.comments.map((c) => ({ id: c.id, userName: c.author, body: c.body, createdAt: c.at })),
    attachments: [],
    history: [],
  };
}

function visible(ctx: Ctx): TaskRec[] {
  return db().tasks.filter((t) => ctx.schoolIds.includes(t.schoolId) && (ctx.user.isBgh || t.assigneeIds.includes(ctx.user.staff.id)));
}

function requireTask(ctx: Ctx): TaskRec {
  const task = visible(ctx).find((t) => t.id === ctx.params.id);
  if (!task) notFound("công việc");
  return task;
}

function validate(schoolId: string, body: S["UpdateTaskRequest"]) {
  if (!body?.title?.trim()) throw new MockError(400, "Vui lòng nhập tên việc.");
  if (!body.dueAt) throw new MockError(400, "Vui lòng chọn hạn hoàn thành.");
  const ids = new Set(schoolStaff(schoolId).map((s) => s.id));
  if (!body.assigneeStaffIds?.length || body.assigneeStaffIds.some((id) => !ids.has(id))) throw new MockError(400, "Chọn người nhận việc thuộc trường.");
}

on("GET", "/tasks", (ctx) => {
  const priority = ctx.query.get("priority");
  const assignee = ctx.query.get("assigneeStaffId");
  const overdue = ctx.query.get("overdue") === "true";
  const list = visible(ctx)
    .filter((t) => (!priority || t.priority === priority) && (!assignee || t.assigneeIds.includes(assignee)) && matches(ctx.query.get("q"), t.title))
    .map((t) => toItem(t, ctx))
    .filter((t) => !overdue || t.overdue)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  return paginate(list, ctx.query);
});

on("GET", "/tasks/{id}", (ctx) => toDetail(requireTask(ctx), ctx));

on("POST", "/tasks", (ctx) => {
  requireBgh(ctx);
  const body = ctx.body as S["CreateTaskRequest"];
  const schoolId = body.schoolId ?? ctx.schoolId;
  if (!ctx.schoolIds.includes(schoolId)) throw new MockError(400, "Vui lòng chọn một trường để giao việc.");
  validate(schoolId, body);
  const task: TaskRec = {
    id: newId(),
    schoolId,
    title: body.title.trim(),
    description: body.description?.trim() ?? "",
    priority: body.priority,
    status: "NEW",
    dueDate: vnDate(body.dueAt!),
    assigneeIds: [...new Set(body.assigneeStaffIds)],
    createdById: ctx.user.staff.id,
    createdAt: nowIso(),
    checklist: (body.checklist ?? []).filter((c) => c.trim()).map((content) => ({ id: newId(), content: content.trim(), done: false })),
    comments: [],
  };
  db().tasks.push(task);
  for (const id of task.assigneeIds) notify(id, "Bạn được giao việc mới", task.title, "/cong-viec");
  return toItem(task, ctx);
});

on("PUT", "/tasks/{id}", (ctx) => {
  requireBgh(ctx);
  const task = requireTask(ctx);
  const body = ctx.body as S["UpdateTaskRequest"];
  validate(task.schoolId, body);
  const added = body.assigneeStaffIds.filter((id) => !task.assigneeIds.includes(id));
  Object.assign(task, {
    title: body.title.trim(),
    description: body.description?.trim() ?? "",
    priority: body.priority,
    dueDate: vnDate(body.dueAt!),
    assigneeIds: [...new Set(body.assigneeStaffIds)],
  });
  for (const id of added) notify(id, "Bạn được giao việc mới", task.title, "/cong-viec");
  return toItem(task, ctx);
});

on("PATCH", "/tasks/{id}/status", (ctx) => {
  const task = requireTask(ctx);
  const status = ctx.body?.status as TaskStatus;
  if (!allowed(task, ctx).includes(status)) throw new MockError(403, "Chỉ người giao việc mới kết thúc được việc.");
  task.status = status;
  task.comments.push({ id: newId(), author: ctx.user.staff.fullName, body: `Chuyển trạng thái: ${LABEL[status]}`, at: nowIso() });
  return toItem(task, ctx);
});

on("POST", "/tasks/{id}/comments", (ctx) => {
  const task = requireTask(ctx);
  const body = ctx.body?.body?.trim();
  if (!body) throw new MockError(400, "Nhập nội dung bình luận.");
  const comment = { id: newId(), author: ctx.user.staff.fullName, body, at: nowIso() };
  task.comments.push(comment);
  return { id: comment.id, userName: comment.author, body, createdAt: comment.at };
});

on("PUT", "/tasks/{id}/checklist/{itemId}", (ctx) => {
  const task = requireTask(ctx);
  const item = task.checklist.find((c) => c.id === ctx.params.itemId);
  if (!item) notFound();
  if (task.status === "DONE") throw new MockError(409, "Việc đã hoàn thành.");
  item.done = !!ctx.body?.done;
  return item;
});
