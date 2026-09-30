import { ApiError, type Problem } from "./errors";
/** Lấy tên file từ header Content-Disposition (ưu tiên filename* UTF-8 để giữ tên tiếng Việt). */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // rơi xuống filename thường
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/** Lưu Blob thành file tải về trên trình duyệt. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Kết quả của một lời gọi API trả file (openapi-fetch với `parseAs: "blob"`). */
export type ExportResult = { data?: Blob; error?: unknown; response: Response };

/** Tải file từ API xuất dữ liệu: ném ApiError nếu lỗi, còn lại lưu về máy với tên do API đặt. */
export async function saveExport(result: ExportResult, fallbackName: string) {
  if (!result.response.ok) {
    throw new ApiError(result.response.status, result.error as Problem | undefined);
  }
  saveBlob(result.data as Blob, fileNameFromDisposition(result.response.headers.get("Content-Disposition"), fallbackName));
}
