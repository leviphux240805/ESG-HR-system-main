package com.preschool.security;

import java.io.IOException;

import com.preschool.common.error.ProblemDetails;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

/** Trả 401/403 phát sinh trong bộ lọc Security dưới dạng RFC 7807 tiếng Việt, giống lỗi từ controller. */
@Component
public class SecurityProblemHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

	private final JsonMapper jsonMapper;

	public SecurityProblemHandlers(JsonMapper jsonMapper) {
		this.jsonMapper = jsonMapper;
	}

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex)
			throws IOException {
		ProblemDetail problem = (ex instanceof InvalidBearerTokenException)
				? ProblemDetails.of(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.",
						"TOKEN_INVALID")
				: ProblemDetails.of(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục.", "UNAUTHENTICATED");
		write(request, response, problem);
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex)
			throws IOException {
		write(request, response,
				ProblemDetails.of(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này.", "FORBIDDEN"));
	}

	void write(HttpServletRequest request, HttpServletResponse response, ProblemDetail problem) throws IOException {
		problem.setInstance(java.net.URI.create(request.getRequestURI()));
		response.setStatus(problem.getStatus());
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		jsonMapper.writeValue(response.getOutputStream(), ProblemDetails.toMap(problem));
	}

}
