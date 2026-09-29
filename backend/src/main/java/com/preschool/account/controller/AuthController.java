package com.preschool.account.controller;

import com.preschool.account.dto.LoginRequest;
import com.preschool.account.dto.TokenResponse;
import com.preschool.account.service.AuthService;
import com.preschool.account.service.AuthService.AuthResult;
import com.preschool.security.AuthProperties;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Xác thực")
@SecurityRequirements
public class AuthController {

	private final AuthService authService;

	private final AuthProperties props;

	public AuthController(AuthService authService, AuthProperties props) {
		this.authService = authService;
		this.props = props;
	}

	@PostMapping("/login")
	@Operation(summary = "Đăng nhập bằng email hoặc số điện thoại",
			description = "Trả access token trong body và đặt refresh token vào cookie httpOnly.")
	public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
		return tokens(authService.login(request.identifier(), request.password(), request.rememberMeOrDefault()));
	}

	@PostMapping("/refresh")
	@Operation(summary = "Lấy access token mới bằng refresh token trong cookie")
	public ResponseEntity<TokenResponse> refresh(
			@Parameter(hidden = true) @CookieValue(name = AuthProperties.REFRESH_COOKIE_NAME, required = false) String refreshToken) {
		return tokens(authService.refresh(refreshToken));
	}

	@PostMapping("/logout")
	@Operation(summary = "Đăng xuất: thu hồi refresh token và xóa cookie")
	@ApiResponse(responseCode = "204", description = "Đã đăng xuất")
	public ResponseEntity<Void> logout(
			@Parameter(hidden = true) @CookieValue(name = AuthProperties.REFRESH_COOKIE_NAME, required = false) String refreshToken) {
		authService.logout(refreshToken);
		ResponseCookie cleared = cookie("").maxAge(0).build();
		return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cleared.toString()).build();
	}

	private ResponseEntity<TokenResponse> tokens(AuthResult result) {
		ResponseCookie.ResponseCookieBuilder cookie = cookie(result.refreshToken());
		if (result.rememberMe()) {
			cookie.maxAge(props.refreshTokenTtl());
		}
		// Không ghi nhớ: cookie phiên, mất khi đóng trình duyệt (token trong DB vẫn hết hạn sau 7 ngày)
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, cookie.build().toString())
			.header(HttpHeaders.CACHE_CONTROL, "no-store")
			.body(new TokenResponse(result.accessToken().value(), "Bearer", result.accessToken().expiresInSeconds()));
	}

	private ResponseCookie.ResponseCookieBuilder cookie(String value) {
		return ResponseCookie.from(AuthProperties.REFRESH_COOKIE_NAME, value)
			.httpOnly(true)
			.secure(props.refreshCookieSecure())
			.sameSite("Strict")
			.path(AuthProperties.REFRESH_COOKIE_PATH);
	}

}
