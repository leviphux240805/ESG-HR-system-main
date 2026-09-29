package com.preschool.account.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Access token trả về trong body; refresh token nằm trong cookie httpOnly, không xuất hiện ở đây. */
public record TokenResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String accessToken,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "Bearer") String tokenType,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số giây còn hiệu lực") long expiresIn) {
}
