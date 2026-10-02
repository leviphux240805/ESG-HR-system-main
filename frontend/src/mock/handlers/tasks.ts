import type { components } from "@/api/schema";
import { db, type TaskRec, type TaskStatus } from "../db";
import { type Ctx, MockError, matches, newId, notFound, nowIso, on, paginate, requireBgh } from "../router";
import { fileMeta, fileUrl } from "../files";
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

/** Thông tin file trong kho demo; file mất sau khi tải lại trang thì bỏ qua. */
const refs = (ids: string[] = []): S["FileRef"][] =>
  ids.flatMap((id) => {
    const f = fileMeta(id);
    return f ? [{ id: f.id, originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.sizeBytes }] : [];
  });

function requireFiles(ids: string[] = []) {
  if (ids.length > 10) throw new MockError(400, "Tối đa 10 file mỗi lần.");
  for (const f of refs(ids)) if (f.sizeBytes > 10 * 1024 * 1024) throw new MockError(400, "Mỗi file đính kèm công việc tối đa 10MB.");
  return ids;
}

function toDetail(t: TaskRec, ctx: Ctx): S["TaskDetail"] {
  return {
    task: toItem(t, ctx),
    description: t.description || undefined,
    assignee: t.assigneeIds.includes(ctx.user.staff.id),
    checklist: t.checklist,
    comments: t.comments.map((c) => ({ id: c.id, userName: c.author, body: c.body, createdAt: c.at, files: refs(c.files) })),
    attachments: (t.attachments ?? []).flatMap((a) => refs([a.fileId]).map((file) => ({ id: a.id, file }))),
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
    attachments: requireFiles(body.attachmentFileIds).map((fileId) => ({ id: newId(), fileId })),
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
  const req = (ctx.body ?? {}) as S["CommentRequest"];
  const body = req.body?.trim() ?? "";
  const files = requireFiles(req.fileIds);
  if (!body && !files.length) throw new MockError(400, "Nhập nội dung hoặc đính kèm file.");
  const comment = { id: newId(), author: ctx.user.staff.fullName, body, at: nowIso(), files };
  task.comments.push(comment);
  return { id: comment.id, userName: comment.author, body, createdAt: comment.at, files: refs(files) };
});

on("POST", "/tasks/{id}/attachments", (ctx) => {
  const task = requireTask(ctx);
  const [fileId] = requireFiles([ctx.body?.fileId]);
  const attachment = { id: newId(), fileId };
  (task.attachments ??= []).push(attachment);
  return { id: attachment.id, file: refs([fileId])[0] };
});

on("DELETE", "/tasks/{id}/attachments/{attachmentId}", (ctx) => {
  requireBgh(ctx);
  const task = requireTask(ctx);
  task.attachments = (task.attachments ?? []).filter((a) => a.id !== ctx.params.attachmentId);
});

on("GET", "/tasks/{id}/files/{fileId}/download-url", (ctx) => {
  requireTask(ctx);
  return { url: fileUrl(ctx.params.fileId), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
});

on("PUT", "/tasks/{id}/checklist/{itemId}", (ctx) => {
  const task = requireTask(ctx);
  const item = task.checklist.find((c) => c.id === ctx.params.itemId);
  if (!item) notFound();
  if (task.status === "DONE") throw new MockError(409, "Việc đã hoàn thành.");
  item.done = !!ctx.body?.done;
  return item;
});
