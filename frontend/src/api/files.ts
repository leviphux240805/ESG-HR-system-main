import { api, unwrap } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type StoredFile = components["schemas"]["FileResponse"];

/** Khớp cấu hình mặc định backend (app.storage.allowed-mime-types, max-size-bytes); backend vẫn kiểm tra lại. */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};
export const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
export const MAX_FILE_MB = 20;

/** Kiểm tra nhanh trước khi upload; trả thông điệp tiếng Việt nếu không hợp lệ. */
export function validateFile(file: File, maxMb = MAX_FILE_MB): string | null {
  if (!ALLOWED_FILE_TYPES[file.type]) {
    return `"${file.name}": loại file không được hỗ trợ. Chỉ nhận PDF, ảnh (JPG, PNG, WEBP), Word và Excel.`;
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `"${file.name}" vượt quá ${maxMb} MB.`;
  }
  if (file.size === 0) {
    return `"${file.name}" là file rỗng.`;
  }
  return null;
}

/** Mở link tải (presigned, có Content-Disposition) ở tab mới. */
export async function openFile(fileId: string) {
  window.open(await getDownloadUrl(fileId), "_blank", "noopener");
}

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
