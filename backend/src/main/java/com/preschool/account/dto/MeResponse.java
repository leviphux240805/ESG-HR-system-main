package com.preschool.account.dto;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;

import io.swagger.v3.oas.annotations.media.Schema;

public record MeResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		String email,
		String phone,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Phải đổi mật khẩu trước khi dùng các chức năng khác") boolean mustChangePassword,
		@Schema(description = "Hồ sơ nhân viên gắn với tài khoản; rỗng = chưa gắn") UUID staffId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) OrganizationSummary organization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<RoleGrant> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Các trường được chọn trên header; từ 2 trường trở lên có thêm \"Tất cả trường\"") List<SchoolSummary> schools) {

	public record OrganizationSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {
	}

	public record RoleGrant(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) RoleCode role,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Nhóm chức năng (chỉ phó hiệu trưởng)") Set<FunctionGroup> functionGroups) {
	}

	public record SchoolSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {
	}

}
