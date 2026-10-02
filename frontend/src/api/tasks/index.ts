import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

type S = components["schemas"];
export type TaskItem = S["TaskItem"];
export type TaskDetail = S["TaskDetail"];
export type TaskStatus = TaskItem["status"];
export type TaskPriority = TaskItem["priority"];
export type CreateTaskRequest = S["CreateTaskRequest"];
export type UpdateTaskRequest = S["UpdateTaskRequest"];

/** Giới hạn mỗi file đính kèm công việc (backend kiểm tra lại). */
export const TASK_FILE_MAX_MB = 10;

/** Cột Kanban (việc đã hủy không hiện trên bảng). */
export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "NEW", label: "Mới" },
  { status: "IN_PROGRESS", label: "Đang làm" },
  { status: "WAITING_APPROVAL", label: "Chờ duyệt" },
  { status: "DONE", label: "Hoàn thành" },
];

export const PRIORITY: Record<TaskPriority, StatusMeta> = {
  LOW: { label: "Thấp", tone: "neutral" },
  MEDIUM: { label: "Trung bình", tone: "info" },
  HIGH: { label: "Cao", tone: "warning" },
  URGENT: { label: "Khẩn", tone: "danger" },
};

export interface TaskFilters {
  q?: string;
  priority?: TaskPriority;
  assigneeStaffId?: string;
  overdue?: boolean;
}

/** Việc trên bảng Kanban (tối đa 100 việc mới nhất theo bộ lọc). */
export function useTasks(filters: TaskFilters) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("tasks", filters),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/tasks", { params: { query: { ...filters, overdue: filters.overdue || undefined, size: 100, page: 0 } as never } })).items,
  });
}

export function useTask(id: string | null) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("tasks", "detail", id),
    queryFn: async () => unwrap(await api.GET("/api/v1/tasks/{id}", { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

/** Nhân viên đang làm ở trường đang chọn, để chọn người nhận việc. */
export function useAssignees() {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("tasks", "assignees"),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff", { params: { query: { status: "ACTIVE", size: 100, page: 0 } as never } })).items,
    staleTime: 5 * 60_000,
  });
}

export async function createTask(body: CreateTaskRequest) {
  return unwrap(await api.POST("/api/v1/tasks", { body }));
}

export async function updateTask(id: string, body: UpdateTaskRequest) {
  return unwrap(await api.PUT("/api/v1/tasks/{id}", { params: { path: { id } }, body }));
}

export async function changeStatus(id: string, status: TaskStatus) {
  return unwrap(await api.PATCH("/api/v1/tasks/{id}/status", { params: { path: { id } }, body: { status } }));
}

export async function addComment(id: string, body: string, fileIds: string[] = []) {
  return unwrap(await api.POST("/api/v1/tasks/{id}/comments", { params: { path: { id } }, body: { body, fileIds } }));
}

export async function attachTaskFile(id: string, fileId: string) {
  return unwrap(await api.POST("/api/v1/tasks/{id}/attachments", { params: { path: { id } }, body: { fileId } }));
}

export async function detachTaskFile(id: string, attachmentId: string) {
  return unwrap(await api.DELETE("/api/v1/tasks/{id}/attachments/{attachmentId}", { params: { path: { id, attachmentId } } }));
}

/** Link ký có hạn để xem (inline) hoặc tải file của việc. */
export async function taskFileUrl(id: string, fileId: string, inline: boolean) {
  return unwrap(await api.GET("/api/v1/tasks/{id}/files/{fileId}/download-url", { params: { path: { id, fileId }, query: { inline } } })).url;
}

export async function toggleChecklist(id: string, itemId: string, done: boolean) {
  return unwrap(await api.PUT("/api/v1/tasks/{id}/checklist/{itemId}", { params: { path: { id, itemId } }, body: { done } }));
}
