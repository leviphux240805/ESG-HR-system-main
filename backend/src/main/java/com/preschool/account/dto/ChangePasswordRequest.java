package com.preschool.account.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
		@NotBlank @Size(max = 200) String currentPassword,
		@Schema(description = "Mật khẩu mới: ít nhất 8 ký tự, gồm cả chữ và số, khác mật khẩu hiện tại")
		@NotBlank @Size(max = 200) String newPassword) {
}
