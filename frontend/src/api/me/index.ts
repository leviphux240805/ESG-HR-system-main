import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";

type S = components["schemas"];
export type Me = S["MeResponse"];
export type SchoolSummary = S["SchoolSummary"];
export type NotificationDto = S["NotificationDto"];

export async function fetchMe(): Promise<Me> {
  return unwrap(await api.GET("/api/v1/me"));
}

/** Hồ sơ nhân viên gắn với tài khoản đang đăng nhập. */
export function useMyStaff() {
  return useQuery({
    queryKey: ["me", "staff"],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/staff")),
    retry: false,
  });
}

export function useMyDocuments() {
  return useQuery({
    queryKey: ["me", "library", "documents"],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/library/documents")),
  });
}

const NOTIFICATIONS_KEY = ["notifications"];

export function useNotifications(page: number, size: number, enabled = true) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "list", page, size],
    queryFn: async () => unwrap(await api.GET("/api/v1/notifications", { params: { query: { page, size } } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "unread-count"],
    queryFn: async () => unwrap(await api.GET("/api/v1/notifications/unread-count")).count ?? 0,
    refetchInterval: 60_000,
  });
}

export async function markNotificationRead(id: string) {
  return unwrap(await api.POST("/api/v1/notifications/{id}/read", { params: { path: { id } } }));
}

export async function markAllNotificationsRead() {
  return unwrap(await api.POST("/api/v1/notifications/read-all"));
}
