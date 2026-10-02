import type { components } from "@/api/schema";
import { MockError, newId } from "./router";

type StoredFile = components["schemas"]["FileResponse"];

/** Kho file của bản demo: giữ blob URL trong bộ nhớ (mất khi tải lại trang, như dữ liệu chưa lưu). */
const files = new Map<string, { meta: StoredFile; url: string }>();

export function storeFile(file: File, schoolId?: string): StoredFile {
  const meta: StoredFile = { id: newId(), originalName: file.name, mimeType: file.type, sizeBytes: file.size, schoolId, status: "READY" };
  files.set(meta.id, { meta, url: URL.createObjectURL(file) });
  return meta;
}

export function fileMeta(id: string): StoredFile | undefined {
  return files.get(id)?.meta;
}

export function fileUrl(id: string): string {
  const stored = files.get(id);
  if (!stored) throw new MockError(404, "Tệp không còn trong bản demo (file chỉ giữ tới khi tải lại trang).");
  return stored.url;
}
