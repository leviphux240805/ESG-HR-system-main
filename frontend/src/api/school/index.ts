import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";

type S = components["schemas"];
export type ClassItem = S["ClassItem"];
export type ChildItem = S["ChildItem"];
export type ChildDetail = S["ChildDetail"];
export type ChildProfileRequest = S["ChildProfileRequest"];
export type CreateChildRequest = S["CreateChildRequest"];
export type RollCall = S["RollCall"];
export type RollCallRow = S["RollCallRow"];
export type MarkRow = S["MarkRow"];
export type ChildAttendanceStatus = MarkRow["status"];
export type ChildStatus = ChildItem["status"];
export type TodaySummary = S["TodaySummary"];
export type TodayClass = S["TodayClass"];
export type ApprovalItem = S["ApprovalItem"];
export type ApprovalType = ApprovalItem["type"];

export const ATTENDANCE_LABELS: Record<ChildAttendanceStatus, string> = {
  PRESENT: "Có mặt",
  EXCUSED: "Vắng có phép",
  ABSENT: "Vắng không phép",
};

export const CHILD_STATUS: Record<ChildStatus, StatusMeta> = {
  STUDYING: { label: "Đang học", tone: "success" },
  RESERVED: { label: "Bảo lưu", tone: "warning" },
  LEFT: { label: "Đã nghỉ", tone: "neutral" },
  COMPLETED: { label: "Hoàn thành", tone: "info" },
};

// ---- Hôm nay, dạy thay, Hộp duyệt ----

export function useToday() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("today"), queryFn: async () => unwrap(await api.GET("/api/v1/today")) });
}

export async function assignSubstitute(body: S["SubstitutionRequest"]) {
  return unwrap(await api.POST("/api/v1/substitutions", { body }));
}

export function useApprovals() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("approvals"), queryFn: async () => unwrap(await api.GET("/api/v1/approvals")) });
}

export async function decideApproval(item: Pick<ApprovalItem, "type" | "id">, approve: boolean, note?: string) {
  const params = { path: { type: item.type, id: item.id } };
  return approve
    ? unwrap(await api.POST("/api/v1/approvals/{type}/{id}/approve", { params, body: { note } }))
    : unwrap(await api.POST("/api/v1/approvals/{type}/{id}/reject", { params, body: { note } }));
}

// ---- Lớp, trẻ ----

/** Lớp của năm học hiện hành trong phạm vi đang chọn (giáo viên: lớp mình phụ trách). */
export function useClasses() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("classes"), queryFn: async () => unwrap(await api.GET("/api/v1/classes")) });
}

export const CHILD_FILTER_KEYS = ["classId", "gender", "status"] as const;

export function useChildren(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = params.apiParams as Record<string, string | number | undefined>;
  return useQuery({
    queryKey: queryKey("children", "list", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/children", { params: { query: query as never } })),
    placeholderData: keepPreviousData,
  });
}

export function useChild(id: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("children", id),
    queryFn: async () => unwrap(await api.GET("/api/v1/children/{id}", { params: { path: { id } } })),
  });
}

export async function createChild(body: CreateChildRequest) {
  return unwrap(await api.POST("/api/v1/children", { body }));
}

export async function updateChild(id: string, body: ChildProfileRequest) {
  return unwrap(await api.PUT("/api/v1/children/{id}", { params: { path: { id } }, body }));
}

// ---- Điểm danh trẻ ----

export function useRollCall(classId: string | undefined, date: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("roll-call", classId, date),
    queryFn: async () => unwrap(await api.GET("/api/v1/classes/{id}/attendance", { params: { path: { id: classId! }, query: { date } } })),
    enabled: !!classId,
  });
}

export async function saveRollCall(classId: string, body: S["MarkRequest"]) {
  return unwrap(await api.PUT("/api/v1/classes/{id}/attendance", { params: { path: { id: classId } }, body }));
}
