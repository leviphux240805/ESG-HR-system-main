import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

type S = components["schemas"];
export type LeaveRequestDto = S["LeaveRequestDto"];
export type LeaveStatus = LeaveRequestDto["status"];

/** Loại nghỉ theo mã công (nửa ngày chỉ cho P, K). */
export const LEAVE_CODES = ["P", "K", "O", "CO", "TS", "T", "NB"] as const;
export type LeaveCode = (typeof LEAVE_CODES)[number];

export const LEAVE_STATUS: Record<LeaveStatus, StatusMeta> = {
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  APPROVED: { label: "Đã duyệt", tone: "success" },
  REJECTED: { label: "Từ chối", tone: "danger" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ["me", "leave-requests"],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/leave-requests")),
  });
}

export function useMyLeaveBalance(year?: number) {
  return useQuery({
    queryKey: ["me", "leave-balance", year],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/leave-balance", { params: { query: { year } } })),
    retry: false,
  });
}

export function usePendingLeaves(enabled: boolean) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("leave", "pending"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/leave-requests", { params: { query: { status: "PENDING", size: 100, page: 0 } } })),
    enabled,
  });
}

export function useLeaveCalendar(month: string, enabled: boolean) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("leave", "calendar", month),
    queryFn: async () => unwrap(await api.GET("/api/v1/leave-requests/calendar", { params: { query: { month } } })),
    enabled,
  });
}

export async function leaveFileUrl(id: string) {
  return unwrap(await api.GET("/api/v1/leave-requests/{id}/file-url", { params: { path: { id } } })).url;
}

/** "02/11/2026" hoặc "02/11 – 04/11/2026". */
export function leaveRange(from: string, to: string): string {
  const f = (d: string, withYear: boolean) => {
    const [y, m, day] = d.split("-");
    return withYear ? `${day}/${m}/${y}` : `${day}/${m}`;
  };
  if (from === to) return f(from, true);
  return `${f(from, from.slice(0, 4) !== to.slice(0, 4))} – ${f(to, true)}`;
}
