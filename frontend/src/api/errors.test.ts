import { describe, expect, it } from "vitest";
import { ApiError, errorMessage } from "./errors";

describe("ApiError / errorMessage", () => {
  it("dùng thông điệp tiếng Việt từ backend", () => {
    const error = new ApiError(404, { title: "Không tìm thấy", status: 404, detail: "Không tìm thấy trẻ.", code: "NOT_FOUND" });
    expect(errorMessage(error)).toBe("Không tìm thấy trẻ.");
    expect(error.code).toBe("NOT_FOUND");
  });

  it("có thông điệp mặc định khi backend không gửi chi tiết", () => {
    expect(errorMessage(new ApiError(500))).toBe("Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.");
    expect(errorMessage(new ApiError(403))).toBe("Bạn không có quyền thực hiện thao tác này.");
  });

  it("lỗi mạng và lỗi lạ không lộ chi tiết kỹ thuật", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe("Không kết nối được máy chủ. Vui lòng kiểm tra mạng.");
    expect(errorMessage(new Error("NullPointerException at X"))).toBe("Đã xảy ra lỗi không xác định.");
  });
});
