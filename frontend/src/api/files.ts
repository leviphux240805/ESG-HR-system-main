import { api, unwrap } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type StoredFile = components["schemas"]["FileResponse"];

/**
 * Upload một file: xin link ký → PUT nội dung thẳng lên storage → xác nhận với backend.
 * Nội dung file không đi qua backend.
 */
export async function uploadFile(file: File, schoolId?: string): Promise<StoredFile> {
  const upload = unwrap(
    await api.POST("/api/v1/files/upload-url", {
      body: { fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size, schoolId },
    }),
  );

  const put = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file });
  if (!put.ok) {
    throw new ApiError(put.status, {
      title: "Không tải được file lên",
      status: put.status,
      detail: "Không tải được file lên kho lưu trữ, vui lòng thử lại.",
    });
  }

  return unwrap(await api.POST("/api/v1/files/{id}/complete", { params: { path: { id: upload.file.id } } }));
}

/** Link tải có hạn (vài phút); mở ngay sau khi nhận. */
export async function getDownloadUrl(fileId: string): Promise<string> {
  return unwrap(await api.GET("/api/v1/files/{id}/download-url", { params: { path: { id: fileId } } })).url;
}
