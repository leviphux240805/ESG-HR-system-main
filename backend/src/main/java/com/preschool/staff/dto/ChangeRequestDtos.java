package com.preschool.staff.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.staff.entity.StaffEnums.ChangeRequestStatus;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/** Đề xuất cập nhật hồ sơ do nhân viên tự gửi. */
public final class ChangeRequestDtos {

	private ChangeRequestDtos() {
	}

	/** CONTACT = số điện thoại, địa chỉ (ban giám hiệu duyệt); BANK = tài khoản ngân hàng (hiệu trưởng hoặc kế toán duyệt). */
	public enum Kind {
		CONTACT, BANK
	}

	public static final List<String> CONTACT_FIELDS = List.of("phone", "permProvinceCode", "permWardCode",
			"permAddressDetail", "currProvinceCode", "currWardCode", "currAddressDetail");

	public static final List<String> BANK_FIELDS = List.of("bankName", "bankAccountNo", "bankAccountHolder");

	public record SubmitChangeRequest(
			@Schema(description = "Giá trị mới theo trường; chỉ một nhóm (liên hệ hoặc ngân hàng) mỗi đề xuất. "
					+ "Liên hệ: phone, permProvinceCode, permWardCode, permAddressDetail, currProvinceCode, currWardCode, "
					+ "currAddressDetail. Ngân hàng: bankName, bankAccountNo, bankAccountHolder. Chuỗi rỗng = xóa giá trị.")
			@NotEmpty Map<String, @Size(max = 300) String> changes) {
	}

	public record ReviewRequest(@Size(max = 500) String note) {
	}

	public record RejectRequest(@NotBlank @Size(max = 500) String note) {
	}

	public record FieldChange(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String field,
			String from, String to) {
	}

	public record ChangeRequestDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Kind kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<FieldChange> changes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ChangeRequestStatus status,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			Instant reviewedAt, String reviewerName, String reviewNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Người đang xem được duyệt/từ chối đề xuất này") boolean canReview) {
	}

}
