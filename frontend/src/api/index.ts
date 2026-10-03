/**
 * Cổng duy nhất để giao diện lấy dữ liệu. Mỗi module viết một lần; chạy bằng backend thật hay dữ liệu giả là do
 * `VITE_DATA_SOURCE` quyết định ở lớp transport, code màn hình không cần biết.
 *
 * Màn hình chỉ import từ `@/api`, không import thẳng `@/api/client` hay `@/mock`.
 */
export { DATA_SOURCE, IS_DEMO, type DataSource } from "./source";
export { ApiError, errorMessage, type Problem } from "./errors";
export { applyApiErrors } from "./formErrors";
export { fileNameFromDisposition, saveBlob, saveExport, type ExportResult } from "./download";
export * from "./files";
export { queryClient } from "./queryClient";
export type { Paged } from "./paging";

export * from "./accounts";
export * from "./attendance";
export * from "./auth";
export * from "./finance";
export * from "./health";
export * from "./leave";
export * from "./library";
export * from "./me";
export * from "./payroll";
export * from "./reports";
export * from "./school";
export * from "./schools";
export * from "./staff";
export * from "./tasks";

/** Phiên đăng nhập (giao diện chỉ dùng qua AuthContext). */
export { refreshAccessToken, setAccessToken, setSelectedSchoolId, setSessionExpiredHandler } from "./client";
