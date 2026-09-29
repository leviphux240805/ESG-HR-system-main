package com.preschool.common.error;

import org.springframework.http.HttpStatus;
import org.springframework.web.ErrorResponseException;

/**
 * Lỗi nghiệp vụ trả về client dạng RFC 7807. {@code detail} là thông điệp tiếng Việt hiển thị cho người dùng,
 * {@code code} là mã máy đọc được để frontend xử lý riêng nếu cần.
 */
public class ApiException extends ErrorResponseException {

	private final String code;

	public ApiException(HttpStatus status, String code, String detail) {
		super(status, ProblemDetails.of(status, detail, code), null);
		this.code = code;
	}

	public String getCode() {
		return code;
	}

	public static ApiException badRequest(String code, String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, code, detail);
	}

	public static ApiException unauthorized(String code, String detail) {
		return new ApiException(HttpStatus.UNAUTHORIZED, code, detail);
	}

	public static ApiException forbidden(String code, String detail) {
		return new ApiException(HttpStatus.FORBIDDEN, code, detail);
	}

	public static ApiException notFound(String detail) {
		return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", detail);
	}

	public static ApiException conflict(String code, String detail) {
		return new ApiException(HttpStatus.CONFLICT, code, detail);
	}

}
