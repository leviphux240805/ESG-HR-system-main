import type { TaskFields, TaskItem, TaskStatus } from "../types";
import { db, type TaskRec } from "../db";
import { type Ctx, MockError, matches, newId, notFound, nowIso, on, requireBgh } from "../router";
import { notify, positionLabel, schoolStaff, staffName, today } from "./common";

const ORDER: TaskStatus[] = ["NEW", "IN_PROGRESS", "WAITING_APPROVAL", "DONE"];

/** BGH chuyển tự do; người nhận chỉ tới "Chờ duyệt" (hoàn thành do người giao duyệt). */
function allowed(task: TaskRec, ctx: Ctx): TaskStatus[] {
  if (ctx.user.isBgh) return ORDER.filter((s) => s !== task.status);
  if (!task.assigneeIds.includes(ctx.user.staff.id) || task.status === "DONE") return [];
  return (["NEW", "IN_PROGRESS", "WAITING_APPROVAL"] as TaskStatus[]).filter((s) => s !== task.status);
}

function toItem(t: TaskRec, ctx: Ctx): TaskItem {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    overdue: t.status !== "DONE" && t.dueDate < today(),
    assignees: t.assigneeIds.map((id) => ({ id, fullName: staffName(id) })),
    createdByName: staffName(t.createdById),
    createdAt: t.createdAt,
    checklist: t.checklist,
    comments: t.comments,
    allowedStatuses: allowed(t, ctx),
    canEdit: ctx.user.isBgh,
  };
}

function visible(ctx: Ctx): TaskRec[] {
  return db().tasks.filter((t) => t.schoolId === ctx.schoolId && (ctx.user.isBgh || t.assigneeIds.includes(ctx.user.staff.id)));
}

function requireTask(ctx: Ctx): TaskRec {
  const task = visible(ctx).find((t) => t.id === ctx.params.id);
  if (!task) notFound("công việc");
  return task;
}

function validate(ctx: Ctx, body: TaskFields) {
  if (!body?.title?.trim()) throw new MockError(400, "Vui lòng nhập tên việc.");
  if (!body.dueDate) throw new MockError(400, "Vui lòng chọn hạn hoàn thành.");
  const ids = new Set(schoolStaff(ctx.schoolId).map((s) => s.id));
  if (!body.assigneeIds?.length || body.assigneeIds.some((id) => !ids.has(id))) throw new MockError(400, "Chọn người nhận việc thuộc cơ sở.");
}

on("GET", "/tasks", (ctx) => {
  const q = ctx.query.get("q");
  const priority = ctx.query.get("priority");
  const mine = ctx.query.get("mine") === "true";
  const overdue = ctx.query.get("overdue") === "true";
  return visible(ctx)
    .filter((t) => (!priority || t.priority === priority) && (!mine || t.assigneeIds.includes(ctx.user.staff.id)) && matches(q, t.title, ...t.assigneeIds.map(staffName)))
    .map((t) => toItem(t, ctx))
    .filter((t) => !overdue || t.overdue)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
});

on("GET", "/tasks/assignees", (ctx) => schoolStaff(ctx.schoolId).map((s) => ({ id: s.id, fullName: s.fullName, position: positionLabel(s) })));

on("POST", "/tasks", (ctx) => {
  requireBgh(ctx);
  const body = ctx.body as TaskFields;
  validate(ctx, body);
  const task: TaskRec = {
    id: newId(),
    schoolId: ctx.schoolId,
    title: body.title.trim(),
    description: body.description?.trim() ?? "",
    priority: body.priority,
    status: "NEW",
    dueDate: body.dueDate,
    assigneeIds: [...new Set(body.assigneeIds)],
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
  const body = ctx.body as TaskFields;
  validate(ctx, body);
  const added = body.assigneeIds.filter((id) => !task.assigneeIds.includes(id));
  Object.assign(task, { title: body.title.trim(), description: body.description?.trim() ?? "", priority: body.priority, dueDate: body.dueDate, assigneeIds: [...new Set(body.assigneeIds)] });
  for (const id of added) notify(id, "Bạn được giao việc mới", task.title, "/cong-viec");
  return toItem(task, ctx);
});

on("PATCH", "/tasks/{id}/status", (ctx) => {
  const task = requireTask(ctx);
  const status = ctx.body?.status as TaskStatus;
  if (!allowed(task, ctx).includes(status)) throw new MockError(403, "Chỉ người giao việc được chuyển sang Hoàn thành.");
  task.status = status;
  task.comments.push({ id: newId(), author: ctx.user.staff.fullName, body: `Chuyển trạng thái: ${{ NEW: "Mới", IN_PROGRESS: "Đang làm", WAITING_APPROVAL: "Chờ duyệt", DONE: "Hoàn thành" }[status]}`, at: nowIso() });
  return toItem(task, ctx);
});

on("POST", "/tasks/{id}/comments", (ctx) => {
  const task = requireTask(ctx);
  const body = ctx.body?.body?.trim();
  if (!body) throw new MockError(400, "Nhập nội dung bình luận.");
  task.comments.push({ id: newId(), author: ctx.user.staff.fullName, body, at: nowIso() });
  return toItem(task, ctx);
});

on("PUT", "/tasks/{id}/checklist/{itemId}", (ctx) => {
  const task = requireTask(ctx);
  const item = task.checklist.find((c) => c.id === ctx.params.itemId);
  if (!item) notFound();
  if (task.status === "DONE") throw new MockError(409, "Việc đã hoàn thành.");
  item.done = !!ctx.body?.done;
  return toItem(task, ctx);
});
