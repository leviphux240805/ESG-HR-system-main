import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { TaskFields, TaskItem, TaskPriority, TaskStatus } from "@/mock/types";

export type { TaskFields, TaskItem, TaskPriority, TaskStatus };

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
  priority?: string;
  mine?: boolean;
  overdue?: boolean;
}

export function useTasks(filters: TaskFilters) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("tasks", filters),
    queryFn: () => apiRequest<TaskItem[]>("GET", "/tasks", { query: { ...filters, mine: filters.mine || undefined, overdue: filters.overdue || undefined } }),
  });
}

export function useAssignees() {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("tasks", "assignees"),
    queryFn: () => apiRequest<{ id: string; fullName: string; position: string }[]>("GET", "/tasks/assignees"),
    staleTime: 5 * 60_000,
  });
}

export const saveTask = (id: string | null, body: TaskFields) =>
  id ? apiRequest<TaskItem>("PUT", `/tasks/${id}`, { body }) : apiRequest<TaskItem>("POST", "/tasks", { body });
export const changeStatus = (id: string, status: TaskStatus) => apiRequest<TaskItem>("PATCH", `/tasks/${id}/status`, { body: { status } });
export const addComment = (id: string, body: string) => apiRequest<TaskItem>("POST", `/tasks/${id}/comments`, { body: { body } });
export const toggleChecklist = (id: string, itemId: string, done: boolean) => apiRequest<TaskItem>("PUT", `/tasks/${id}/checklist/${itemId}`, { body: { done } });
