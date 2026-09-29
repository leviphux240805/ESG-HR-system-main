package com.preschool.account.dto;

import java.util.List;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;

import io.swagger.v3.oas.annotations.media.Schema;

public record MeResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		String phone,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<RoleGrant> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Có vai trò cấp chuỗi: được chọn \"Tất cả cơ sở\"") boolean chainWide,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Các cơ sở được phép chọn trên header") List<SchoolSummary> schools) {

	public record RoleGrant(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) RoleCode role,
			@Schema(description = "Rỗng = toàn chuỗi") UUID schoolId) {
	}

	public record SchoolSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {
	}

}
