package com.preschool.account.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
		@Schema(description = "Email hoặc số điện thoại", example = "owner@preschool.local")
		@NotBlank @Size(max = 255) String identifier,
		@NotBlank @Size(max = 200) String password,
		@Schema(description = "Giữ đăng nhập 7 ngày; bỏ trống/false = hết khi đóng trình duyệt") Boolean rememberMe) {

	public boolean rememberMeOrDefault() {
		return Boolean.TRUE.equals(rememberMe);
	}

}
