import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";

type S = components["schemas"];
export type StaffListItem = S["StaffListItem"];
export type StaffDetail = S["StaffDetail"];
export type StaffSummary = S["StaffSummary"];

/** Bộ lọc của danh sách nhân sự (khóa trên URL). */
export const STAFF_FILTER_KEYS = ["schoolId", "position", "status", "contractExpiring"] as const;

/** Tham số query cho /staff và /staff/export từ trạng thái danh sách. */
export function staffQuery(params: ListParams) {
  const { page, size, sort, q, schoolId, position, status, contractExpiring } = params.apiParams as Record<
    string,
    string | number | undefined
  >;
  return {
    page: page as number,
    size: size as number,
    sort: sort ? [sort as string] : undefined,
    q: q as string | undefined,
    schoolId: schoolId as string | undefined,
    position: position as StaffListItem["position"] | undefined,
    status: status as StaffListItem["status"] | undefined,
    contractExpiring: contractExpiring === "true" ? true : undefined,
  };
}

export function useStaffList(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = staffQuery(params);
  return useQuery({
    queryKey: queryKey("staff", "list", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff", { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useStaffSummary(schoolId?: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("staff", "summary", schoolId),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff/summary", { params: { query: { schoolId } } })),
  });
}

export type DocumentTypeDto = S["DocumentTypeDto"];

/** Danh mục loại giấy tờ nhân viên (dùng chung toàn chuỗi, ít thay đổi). */
export function useDocumentTypes() {
  return useQuery({
    queryKey: ["document-types", "STAFF"],
    queryFn: async () => unwrap(await api.GET("/api/v1/document-types", { params: { query: { scope: "STAFF" } } })),
    staleTime: 30 * 60_000,
  });
}

export async function checkStaffDuplicates(body: S["DuplicateCheckRequest"]) {
  return unwrap(await api.POST("/api/v1/staff/check-duplicates", { body })).duplicates;
}

export async function addStaffDocument(staffId: string, body: S["StaffDocumentRequest"]) {
  return unwrap(await api.POST("/api/v1/staff/{staffId}/documents", { params: { path: { staffId } }, body }));
}

export type ContractDto = S["ContractDto"];
export type StaffDocumentDto = S["StaffDocumentDto"];
export type StaffHistory = S["StaffHistory"];
export type HistoryEvent = S["HistoryEvent"];
export type FileRef = S["FileRef"];

/** Khóa query của một hồ sơ; invalidate ["staff"] làm mới cả danh sách lẫn hồ sơ. */
export function useStaffKey(staffId: string) {
  const { queryKey } = useCurrentSchool();
  return (part: string) => queryKey("staff", staffId, part);
}

export function useStaffDetail(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("detail"),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff/{id}", { params: { path: { id: staffId } } })),
  });
}

export function useStaffContracts(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("contracts"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/staff/{staffId}/contracts", { params: { path: { staffId } } })),
  });
}

export function useStaffDocuments(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("documents"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/staff/{staffId}/documents", { params: { path: { staffId } } })),
  });
}

export function useStaffHistory(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("history"),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff/{staffId}/history", { params: { path: { staffId } } })),
  });
}

export async function updateStaff(staffId: string, body: S["StaffFields"]) {
  return unwrap(await api.PUT("/api/v1/staff/{id}", { params: { path: { id: staffId } }, body }));
}

/** Link có hạn để xem (inline) hoặc tải file thuộc hồ sơ. */
export async function staffFileUrl(staffId: string, fileId: string, inline = false) {
  return unwrap(
    await api.GET("/api/v1/staff/{staffId}/files/{fileId}/download-url", {
      params: { path: { staffId, fileId }, query: { inline } },
    }),
  ).url;
}

/** Xuất Excel theo bộ lọc hiện tại, hoặc theo danh sách id đã chọn. */
export function exportStaff(params: ListParams, ids?: string[]) {
  const { page: _page, size: _size, sort: _sort, ...filters } = staffQuery(params);
  return api.GET("/api/v1/staff/export", {
    params: { query: { ...filters, ids: ids && ids.length > 0 ? ids : undefined } },
    parseAs: "blob",
  });
}

export type SalaryConfigDto = S["SalaryConfigDto"];
export type DependentDto = S["DependentDto"];
export type CertificateDto = S["CertificateDto"];
export type TrainingDto = S["TrainingDto"];

export function useSalaryConfigs(staffId: string, enabled: boolean) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("salary-configs"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/staff/{staffId}/salary-configs", { params: { path: { staffId } } })),
    enabled,
  });
}

export function useDependents(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("dependents"),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff/{staffId}/dependents", { params: { path: { staffId } } })),
  });
}

export function useCertificates(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("certificates"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/staff/{staffId}/certificates", { params: { path: { staffId } } })),
  });
}

export function useTrainings(staffId: string) {
  const key = useStaffKey(staffId);
  return useQuery({
    queryKey: key("trainings"),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff/{staffId}/trainings", { params: { path: { staffId } } })),
  });
}
