package com.preschool.account.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Quản lý tài khoản đăng nhập (chủ chuỗi, văn phòng điều hành). */
public final class AccountDtos {

	private AccountDtos() {
	}

	public record AccountRole(@NotNull RoleCode role,
			@Schema(description = "Rỗng = toàn chuỗi") UUID schoolId) {
	}

	public record AccountRoleView(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) RoleCode role,
			@Schema(description = "Rỗng = toàn chuỗi") UUID schoolId,
			String schoolName) {
	}

	public record AccountItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
			String phone,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			Instant lastLoginAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AccountRoleView> roles,
			UUID staffId, String staffCode, String staffName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Tài khoản của chính người đang xem") boolean self) {
	}

	public record CreateAccountRequest(
			@NotBlank @Email @Size(max = 255) String email,
			@Pattern(regexp = "^[0-9 +().-]{9,20}$", message = "số điện thoại không hợp lệ") String phone,
			@Schema(description = "Bỏ trống khi gắn hồ sơ nhân viên (lấy họ tên từ hồ sơ)") @Size(max = 200) String fullName,
			@Schema(description = "Hồ sơ nhân viên gắn với tài khoản") UUID staffId,
			@NotNull @Size(min = 1) List<@Valid AccountRole> roles) {
	}

	public record UpdateRolesRequest(@NotNull @Size(min = 1) List<@Valid AccountRole> roles) {
	}

}
