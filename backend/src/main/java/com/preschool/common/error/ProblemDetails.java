package com.preschool.common.error;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

/** Tạo {@link ProblemDetail} (RFC 7807) với tiêu đề tiếng Việt theo mã HTTP. */
public final class ProblemDetails {

	/** Thuộc tính mở rộng: mã lỗi máy đọc được, ví dụ {@code INVALID_CREDENTIALS}. */
	public static final String CODE = "code";

	/** Thuộc tính mở rộng: danh sách lỗi từng trường khi dữ liệu không hợp lệ. */
	public static final String ERRORS = "errors";

	private ProblemDetails() {
	}

	public static ProblemDetail of(HttpStatusCode status, String detail, String code) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(titleFor(status));
		if (code != null) {
			problem.setProperty(CODE, code);
		}
		return problem;
	}

	public static String titleFor(HttpStatusCode status) {
		HttpStatus known = HttpStatus.resolve(status.value());
		if (known == null) {
			return status.is5xxServerError() ? "Lỗi hệ thống" : "Yêu cầu không hợp lệ";
		}
		return switch (known) {
			case BAD_REQUEST -> "Yêu cầu không hợp lệ";
			case UNAUTHORIZED -> "Chưa đăng nhập";
			case FORBIDDEN -> "Không có quyền truy cập";
			case NOT_FOUND -> "Không tìm thấy";
			case METHOD_NOT_ALLOWED -> "Phương thức không được hỗ trợ";
			case NOT_ACCEPTABLE -> "Không đáp ứng được định dạng yêu cầu";
			case CONFLICT -> "Xung đột dữ liệu";
			case CONTENT_TOO_LARGE -> "Dữ liệu quá lớn";
			case UNSUPPORTED_MEDIA_TYPE -> "Định dạng không được hỗ trợ";
			case UNPROCESSABLE_CONTENT -> "Không xử lý được yêu cầu";
			case TOO_MANY_REQUESTS -> "Quá nhiều yêu cầu";
			default -> known.is5xxServerError() ? "Lỗi hệ thống" : "Yêu cầu không hợp lệ";
		};
	}

	/** Dạng Map để ghi JSON bên ngoài Spring MVC (bộ lọc Security). */
	public static Map<String, Object> toMap(ProblemDetail problem) {
		Map<String, Object> map = new LinkedHashMap<>();
		map.put("type", problem.getType() == null ? "about:blank" : problem.getType().toString());
		map.put("title", problem.getTitle());
		map.put("status", problem.getStatus());
		map.put("detail", problem.getDetail());
		if (problem.getInstance() != null) {
			map.put("instance", problem.getInstance().toString());
		}
		if (problem.getProperties() != null) {
			map.putAll(problem.getProperties());
		}
		return map;
	}

}
