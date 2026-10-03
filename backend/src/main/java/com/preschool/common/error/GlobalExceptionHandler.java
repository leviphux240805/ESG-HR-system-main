package com.preschool.common.error;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Mọi lỗi trả về client theo RFC 7807 ({@code application/problem+json}) với tiêu đề và thông điệp tiếng Việt.
 * Lỗi 401/403 phát sinh trong bộ lọc Security do {@code SecurityProblemHandlers} xử lý.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(AccessDeniedException.class)
	ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex) {
		return build(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này.", "FORBIDDEN");
	}

	@ExceptionHandler(AuthenticationException.class)
	ResponseEntity<ProblemDetail> handleAuthentication(AuthenticationException ex) {
		return build(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục.", "UNAUTHENTICATED");
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex) {
		log.warn("Vi phạm ràng buộc dữ liệu: {}", ex.getMostSpecificCause().getMessage());
		return build(HttpStatus.CONFLICT, "Dữ liệu bị trùng hoặc vi phạm ràng buộc.", "DATA_CONFLICT");
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
		log.error("Lỗi không mong đợi", ex);
		return build(HttpStatus.INTERNAL_SERVER_ERROR, "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.",
				"INTERNAL_ERROR");
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<Map<String, String>> errors = new ArrayList<>();
		for (FieldError error : ex.getBindingResult().getFieldErrors()) {
			// Lỗi chuyển kiểu (tham số lọc sai định dạng) có thông điệp tiếng Anh kèm tên lớp Java: thay bằng câu chung
			String message = error.isBindingFailure() ? "Giá trị không hợp lệ."
					: String.valueOf(error.getDefaultMessage());
			errors.add(Map.of("field", error.getField(), "message", message));
		}
		ex.getBindingResult()
			.getGlobalErrors()
			.forEach(error -> errors.add(Map.of("field", "", "message", String.valueOf(error.getDefaultMessage()))));
		return validationProblem(errors, headers);
	}

	@Override
	protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<Map<String, String>> errors = new ArrayList<>();
		ex.getParameterValidationResults()
			.forEach(result -> result.getResolvableErrors()
				.forEach(error -> errors.add(Map.of("field",
						String.valueOf(result.getMethodParameter().getParameterName()), "message",
						String.valueOf(error.getDefaultMessage())))));
		return validationProblem(errors, headers);
	}

	/** Dịch thông điệp mặc định (tiếng Anh) của Spring MVC sang tiếng Việt. */
	@Override
	protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
			HttpStatusCode statusCode, WebRequest request) {
		// Lớp cha dựng body từ ErrorResponse khi body == null, nên dịch sau khi gọi super
		ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
		if (response != null && response.getBody() instanceof ProblemDetail problem && !(ex instanceof ApiException)) {
			problem.setTitle(ProblemDetails.titleFor(statusCode));
			problem.setDetail(detailFor(ex, statusCode));
		}
		return response;
	}

	private static String detailFor(Exception ex, HttpStatusCode status) {
		return switch (ex) {
			case HttpMessageNotReadableException e -> "Dữ liệu gửi lên không đúng định dạng.";
			case MissingServletRequestParameterException e -> "Thiếu tham số bắt buộc: " + e.getParameterName() + ".";
			case MissingRequestHeaderException e -> "Thiếu header bắt buộc: " + e.getHeaderName() + ".";
			case MethodArgumentTypeMismatchException e -> "Giá trị không hợp lệ cho tham số: " + e.getName() + ".";
			case NoResourceFoundException e -> "Không tìm thấy đường dẫn yêu cầu.";
			case HttpRequestMethodNotSupportedException e ->
				"Phương thức " + e.getMethod() + " không được hỗ trợ cho đường dẫn này.";
			case HttpMediaTypeNotSupportedException e -> "Kiểu nội dung gửi lên không được hỗ trợ.";
			case MaxUploadSizeExceededException e -> "Dữ liệu gửi lên vượt quá kích thước cho phép.";
			default -> ProblemDetails.titleFor(status) + ".";
		};
	}

	private ResponseEntity<Object> validationProblem(List<Map<String, String>> errors, HttpHeaders headers) {
		ProblemDetail problem = ProblemDetails.of(HttpStatus.BAD_REQUEST, "Dữ liệu không hợp lệ.", "VALIDATION_FAILED");
		problem.setProperty(ProblemDetails.ERRORS, errors);
		return ResponseEntity.badRequest().headers(headers).body(problem);
	}

	private static ResponseEntity<ProblemDetail> build(HttpStatus status, String detail, String code) {
		return ResponseEntity.status(status).body(ProblemDetails.of(status, detail, code));
	}

}
