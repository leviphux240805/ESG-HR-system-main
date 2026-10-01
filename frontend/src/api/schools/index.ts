import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";

type S = components["schemas"];
export type SchoolDto = S["SchoolDto"];
export type SchoolRequest = S["SchoolRequest"];

/** Các trường của tôi (không theo trường đang chọn trên header). */
export function useSchools() {
  return useQuery({ queryKey: ["schools"], queryFn: async () => unwrap(await api.GET("/api/v1/schools")) });
}

export async function saveSchool(id: string | null, body: SchoolRequest) {
  return id
    ? unwrap(await api.PUT("/api/v1/schools/{id}", { params: { path: { id } }, body }))
    : unwrap(await api.POST("/api/v1/schools", { body }));
}

export async function setSchoolActive(id: string, active: boolean) {
  return active
    ? unwrap(await api.POST("/api/v1/schools/{id}/activate", { params: { path: { id } } }))
    : unwrap(await api.POST("/api/v1/schools/{id}/deactivate", { params: { path: { id } } }));
}
