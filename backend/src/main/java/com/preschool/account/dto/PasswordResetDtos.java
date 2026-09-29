package com.preschool.account.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** DTO của luồng quên mật khẩu. */
public final class PasswordResetDtos {

	private PasswordResetDtos() {
	}

	public record ForgotPasswordRequest(
			@Schema(description = "Email hoặc số điện thoại", example = "owner@preschool.local")
			@NotBlank @Size(max = 255) String identifier) {
	}

	public record ResetPasswordRequest(
			@Schema(description = "Token trong link email") @NotBlank @Size(max = 200) String token,
			@Schema(description = "Mật khẩu mới: ít nhất 8 ký tự, gồm cả chữ và số")
			@NotBlank @Size(max = 200) String newPassword) {
	}

}
