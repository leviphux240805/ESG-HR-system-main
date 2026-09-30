import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";

type S = components["schemas"];
export type FolderDto = S["FolderDto"];
export type LibraryDocumentItem = S["DocumentItem"];
export type LibraryDocumentDetail = S["DocumentDetail"];
export type LibraryVersion = S["VersionDto"];
export type LibraryReader = S["ReaderDto"];
export type LibraryRole = S["RoleGrant"]["role"];

/** Bộ lọc danh sách văn bản trên URL: thư mục (id hoặc "unfiled"). */
export const LIBRARY_FILTER_KEYS = ["folder"] as const;
export const UNFILED = "unfiled";

export function useFolders() {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("library", "folders"),
    queryFn: async () => unwrap(await api.GET("/api/v1/library/folders")),
  });
}

export function useLibraryDocuments(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const { page, size, sort, q, folder } = params.apiParams as Record<string, string | number | undefined>;
  const query = {
    page: page as number,
    size: size as number,
    sort: sort ? [sort as string] : undefined,
    q: q as string | undefined,
    folderId: folder && folder !== UNFILED ? (folder as string) : undefined,
    unfiled: folder === UNFILED ? true : undefined,
  };
  return useQuery({
    queryKey: queryKey("library", "documents", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/library/documents", { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useLibraryDocument(id: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("library", "document", id),
    queryFn: async () => unwrap(await api.GET("/api/v1/library/documents/{id}", { params: { path: { id } } })),
  });
}

export function useReaders(id: string, enabled: boolean) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("library", "document", id, "readers"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/library/documents/{id}/readers", { params: { path: { id } } })),
    enabled,
  });
}

/** Link có hạn để xem (inline) hoặc tải một phiên bản. */
export async function libraryFileUrl(id: string, versionNo: number, inline: boolean) {
  return unwrap(
    await api.GET("/api/v1/library/documents/{id}/versions/{versionNo}/download-url", {
      params: { path: { id, versionNo }, query: { inline } },
    }),
  ).url;
}

export async function ackDocument(id: string) {
  return unwrap(await api.POST("/api/v1/library/documents/{id}/ack", { params: { path: { id } } }));
}

export async function remindDocument(id: string) {
  return unwrap(await api.POST("/api/v1/library/documents/{id}/remind", { params: { path: { id } } }));
}

export async function deleteDocument(id: string) {
  return unwrap(await api.DELETE("/api/v1/library/documents/{id}", { params: { path: { id } } }));
}

export async function renameFolder(id: string, body: S["RenameFolderRequest"]) {
  return unwrap(await api.PUT("/api/v1/library/folders/{id}", { params: { path: { id } }, body }));
}

export async function createFolder(body: S["CreateFolderRequest"]) {
  return unwrap(await api.POST("/api/v1/library/folders", { body }));
}

export async function deleteFolder(id: string) {
  return unwrap(await api.DELETE("/api/v1/library/folders/{id}", { params: { path: { id } } }));
}

export async function updateDocument(id: string, body: S["UpdateDocumentRequest"]) {
  return unwrap(await api.PUT("/api/v1/library/documents/{id}", { params: { path: { id } }, body }));
}

export async function createDocument(body: S["CreateDocumentRequest"]) {
  return unwrap(await api.POST("/api/v1/library/documents", { body }));
}

export async function addDocumentVersion(id: string, body: S["NewVersionRequest"]) {
  return unwrap(await api.POST("/api/v1/library/documents/{id}/versions", { params: { path: { id } }, body }));
}
