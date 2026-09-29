import type { components } from "./schema";

export type Problem = components["schemas"]["Problem"];

/** Lỗi từ API (RFC 7807). `message` là thông điệp tiếng Việt hiển thị được cho người dùng. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly problem?: Problem;

  constructor(status: number, problem?: Problem) {
    super(problem?.detail || problem?.title || messageForStatus(status));
    this.name = "ApiError";
    this.status = status;
    this.code = problem?.code;
    this.problem = problem;
  }
}

function messageForStatus(status: number): string {
  if (status === 0) return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.";
  if (status >= 500) return "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.";
  if (status === 401) return "Vui lòng đăng nhập để tiếp tục.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy dữ liệu.";
  return "Yêu cầu không hợp lệ.";
}

/** Thông điệp tiếng Việt cho mọi loại lỗi (dùng trong toast). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return messageForStatus(0);
  return "Đã xảy ra lỗi không xác định.";
}
