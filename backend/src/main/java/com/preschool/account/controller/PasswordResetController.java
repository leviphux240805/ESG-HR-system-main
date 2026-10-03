package com.preschool.account.controller;

import com.preschool.account.dto.PasswordResetDtos.ForgotPasswordRequest;
import com.preschool.account.dto.PasswordResetDtos.ResetPasswordRequest;
import com.preschool.account.service.PasswordResetService;
import com.preschool.security.LoginRateLimiter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Xác thực")
@SecurityRequirements
public class PasswordResetController {

	private final PasswordResetService passwordResetService;

	private final LoginRateLimiter limiter;

	public PasswordResetController(PasswordResetService passwordResetService, LoginRateLimiter limiter) {
		this.passwordResetService = passwordResetService;
		this.limiter = limiter;
	}

	@PostMapping("/forgot-password")
	@Operation(summary = "Gửi email đặt lại mật khẩu",
			description = "Luôn trả 204 dù tài khoản có tồn tại hay không, để không lộ thông tin tài khoản.")
	@ApiResponse(responseCode = "204", description = "Đã tiếp nhận")
	public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
			HttpServletRequest http) {
		// Mỗi yêu cầu gửi một email: tính như một lần thử để không bị dùng spam hộp thư
		String key = "reset:" + request.identifier();
		String ip = LoginRateLimiter.clientIp(http);
		limiter.check(key, ip);
		limiter.failed(key, ip);
		passwordResetService.requestReset(request.identifier());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/reset-password")
	@Operation(summary = "Đặt mật khẩu mới bằng link trong email",
			description = "Thành công thì mọi phiên đăng nhập của tài khoản bị đăng xuất.")
	@ApiResponse(responseCode = "204", description = "Đã đổi mật khẩu")
	public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
		passwordResetService.resetPassword(request.token(), request.newPassword());
		return ResponseEntity.noContent().build();
	}

}
