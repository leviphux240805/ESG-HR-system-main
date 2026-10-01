package com.preschool.account.dto;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Quản lý tài khoản đăng nhập (hiệu trưởng). */
public final class AccountDtos {

	private AccountDtos() {
	}

	public record AccountRole(@NotNull(message = "Vui lòng chọn vai trò.") RoleCode role,
			@NotNull(message = "Vui lòng chọn trường.") UUID schoolId,
			@Schema(description = "Nhóm chức năng, chỉ dùng cho phó hiệu trưởng") Set<FunctionGroup> functionGroups) {
	}

	public record AccountRoleView(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) RoleCode role,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Set<FunctionGroup> functionGroups,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Người đang xem sửa được vai trò này (hiệu trưởng của trường đó)") boolean editable) {
	}

	public record AccountItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			String email,
			String phone,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Đang dùng mật khẩu do người khác đặt, chưa tự đổi") boolean mustChangePassword,
			Instant lastLoginAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AccountRoleView> roles,
			UUID staffId, String staffCode, String staffName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Tài khoản của chính người đang xem") boolean self,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Tài khoản hiệu trưởng: chỉ bên vận hành sửa vai trò, khóa") boolean principal) {
	}

	public record CreateAccountRequest(
			@Schema(description = "Email hoặc số điện thoại, cần ít nhất một") @Email @Size(max = 255) String email,
			@Pattern(regexp = "^[0-9 +().-]{9,20}$", message = "số điện thoại không hợp lệ") String phone,
			@Schema(description = "Bỏ trống khi gắn hồ sơ nhân viên (lấy họ tên từ hồ sơ)") @Size(max = 200) String fullName,
			@Schema(description = "Hồ sơ nhân viên gắn với tài khoản") UUID staffId,
			@NotNull @Size(min = 1) List<@Valid AccountRole> roles,
			@Schema(description = "Mật khẩu ban đầu: ít nhất 8 ký tự, gồm cả chữ và số") @NotBlank @Size(max = 200) String password) {
	}

	public record SetPasswordRequest(
			@Schema(description = "Mật khẩu mới: ít nhất 8 ký tự, gồm cả chữ và số") @NotBlank @Size(max = 200) String password) {
	}

	public record UpdateRolesRequest(@NotNull @Size(min = 1) List<@Valid AccountRole> roles) {
	}

}
