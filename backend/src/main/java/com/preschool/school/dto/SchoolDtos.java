package com.preschool.school.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Quản lý trường (hiệu trưởng). */
public final class SchoolDtos {

	private SchoolDtos() {
	}

	public record SchoolDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) com.preschool.school.entity.SchoolType type,
			@Schema(description = "Trường chính của phân hiệu") UUID parentId,
			String provinceCode,
			String wardCode,
			String addressDetail,
			String phone,
			String licenseNo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Người đang xem là hiệu trưởng của trường") boolean canEdit) {
	}

	public record SchoolRequest(
			@NotBlank(message = "Vui lòng nhập mã trường.") @Size(max = 20, message = "Mã trường tối đa 20 ký tự.")
			@Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "Mã trường chỉ gồm chữ, số, gạch ngang, gạch dưới.") String code,
			@NotBlank(message = "Vui lòng nhập tên trường.") @Size(max = 200, message = "Tên trường tối đa 200 ký tự.") String name,
			@Size(max = 10) String provinceCode,
			@Size(max = 10) String wardCode,
			@Size(max = 300, message = "Địa chỉ tối đa 300 ký tự.") String addressDetail,
			@Pattern(regexp = "^[0-9 +().-]{9,20}$", message = "Số điện thoại không hợp lệ.") String phone,
			@Size(max = 50, message = "Số giấy phép tối đa 50 ký tự.") String licenseNo) {
	}

}
