package com.preschool.security;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import com.preschool.common.error.ApiException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Sau khi xác thực JWT: nạp phạm vi từ {@code user_roles}, kiểm tra header {@code X-School-Id}, gắn vai trò
 * ({@code ROLE_*}) áp dụng cho cơ sở đang chọn và đặt {@link SchoolScope} cho request.
 */
public class SchoolScopeFilter extends OncePerRequestFilter {

	private final SchoolAccessService accessService;

	private final SecurityProblemHandlers problemHandlers;

	public SchoolScopeFilter(SchoolAccessService accessService, SecurityProblemHandlers problemHandlers) {
		this.accessService = accessService;
		this.problemHandlers = problemHandlers;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		SecurityContext context = SecurityContextHolder.getContext();
		if (!(context.getAuthentication() instanceof JwtAuthenticationToken jwtAuth)) {
			chain.doFilter(request, response);
			return;
		}

		SchoolScope scope;
		try {
			SchoolAccess access = accessService.load(UUID.fromString(jwtAuth.getName()));
			scope = new SchoolScope(access, selectedSchool(request, access));
		}
		catch (ApiException ex) {
			problemHandlers.write(request, response, ex.getBody());
			return;
		}

		List<GrantedAuthority> authorities = scope.access()
			.grants()
			.stream()
			.filter(g -> scope.hasRole(g.role()))
			.map(g -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + g.role().name()))
			.distinct()
			.toList();
		JwtAuthenticationToken withRoles = new JwtAuthenticationToken(jwtAuth.getToken(), authorities,
				jwtAuth.getName());
		withRoles.setDetails(jwtAuth.getDetails());
		context.setAuthentication(withRoles);

		SchoolScope.set(scope);
		try {
			chain.doFilter(request, response);
		}
		finally {
			SchoolScope.clear();
		}
	}

	private static UUID selectedSchool(HttpServletRequest request, SchoolAccess access) {
		String path = request.getRequestURI().substring(request.getContextPath().length());
		if (SchoolScope.isSchoolAgnostic(path)) {
			return null;
		}
		String header = request.getHeader(SchoolScope.HEADER);
		if (header == null || header.isBlank()) {
			return null;
		}
		UUID schoolId;
		try {
			schoolId = UUID.fromString(header.trim());
		}
		catch (IllegalArgumentException ex) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "SCHOOL_HEADER_INVALID",
					"Header X-School-Id không phải mã cơ sở hợp lệ.");
		}
		if (!access.canAccess(schoolId)) {
			throw new ApiException(HttpStatus.FORBIDDEN, "SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
		}
		return schoolId;
	}

}
