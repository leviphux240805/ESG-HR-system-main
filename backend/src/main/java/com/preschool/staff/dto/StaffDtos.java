package com.preschool.staff.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.staff.entity.StaffEnums.Gender;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.Qualification;
import com.preschool.staff.entity.StaffEnums.StaffStatus;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** DTO của API hồ sơ nhân viên. */
public final class StaffDtos {

	private StaffDtos() {
	}

	/** Dòng trong danh sách nhân sự. */
	public record StaffListItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			UUID photoFileId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Position position,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			String phone,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate startDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) StaffStatus status,
			@Schema(description = "Ngày hết hạn hợp đồng hiện hành; rỗng = không thời hạn hoặc chưa có") LocalDate contractEndDate) {
	}

	/** Thẻ tóm tắt đầu trang danh sách. */
	public record StaffSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Nhân viên đang làm") long total,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<Position, Long> byPosition,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Hợp đồng, chứng chỉ, giấy tờ hết hạn trong 30 ngày") long expiringDocuments) {
	}

	/** Thông tin ngân hàng: chỉ trả cho người được xem lương (không gồm hiệu trưởng). */
	public record BankInfo(String bankName, String bankAccountNo, String bankAccountHolder) {
	}

	/** Quyền của người đang xem trên hồ sơ này (để giao diện ẩn/hiện; backend vẫn kiểm tra lại). */
	public record StaffPermissions(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canViewSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManageSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canTransfer,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canTerminate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean isSelf) {
	}

	public record StaffDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			LocalDate dob,
			Gender gender,
			String ethnicity,
			String citizenId,
			LocalDate citizenIdIssuedOn,
			String phone,
			String email,
			String permProvinceCode,
			String permWardCode,
			String permAddressDetail,
			String currProvinceCode,
			String currWardCode,
			String currAddressDetail,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Position position,
			Qualification qualification,
			String specialization,
			String socialInsuranceNo,
			String healthInsuranceNo,
			String personalTaxCode,
			UUID photoFileId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate startDate,
			LocalDate endDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) StaffStatus status,
			String terminationReason,
			@Schema(description = "Rỗng nếu người xem không được xem thông tin lương/ngân hàng") BankInfo bank,
			@Schema(description = "Tài khoản đăng nhập gắn với hồ sơ (nếu có)") LinkedAccount account,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) StaffPermissions permissions) {
	}

	public record LinkedAccount(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID userId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<RoleCode> roles) {
	}

	/** Trường hồ sơ sửa được (không gồm cơ sở, trạng thái, lương, ngân hàng: có thao tác riêng). */
	public record StaffFields(
			@NotBlank @Size(max = 200) String fullName,
			LocalDate dob,
			Gender gender,
			@Size(max = 50) String ethnicity,
			@Pattern(regexp = "^\\d{12}$", message = "số CCCD phải gồm 12 chữ số") String citizenId,
			LocalDate citizenIdIssuedOn,
			@Pattern(regexp = "^[0-9 +().-]{9,20}$", message = "số điện thoại không hợp lệ") String phone,
			@Email @Size(max = 255) String email,
			@Size(max = 5) String permProvinceCode,
			@Size(max = 10) String permWardCode,
			@Size(max = 300) String permAddressDetail,
			@Size(max = 5) String currProvinceCode,
			@Size(max = 10) String currWardCode,
			@Size(max = 300) String currAddressDetail,
			@NotNull Position position,
			Qualification qualification,
			@Size(max = 200) String specialization,
			@Size(max = 20) String socialInsuranceNo,
			@Size(max = 20) String healthInsuranceNo,
			@Size(max = 15) String personalTaxCode,
			UUID photoFileId,
			@NotNull LocalDate startDate) {
	}

	/** Tạo tài khoản đăng nhập cùng lúc với hồ sơ (chỉ văn phòng điều hành/chủ chuỗi). */
	public record NewAccount(
			@Schema(description = "Vai trò kèm cơ sở; bỏ trống schoolId = toàn chuỗi")
			@NotNull @Size(min = 1) List<@Valid RoleAssignment> roles) {
	}

	public record RoleAssignment(@NotNull RoleCode role, UUID schoolId) {
	}

	public record CreateStaffRequest(
			@Schema(description = "Cơ sở làm việc; bỏ trống = cơ sở đang chọn") UUID schoolId,
			@NotNull @Valid StaffFields fields,
			@Schema(description = "Bỏ trống nếu không tạo tài khoản đăng nhập") @Valid NewAccount account) {
	}

	public record DuplicateCheckRequest(String citizenId, String phone, String email,
			@Schema(description = "Bỏ qua chính hồ sơ này khi đang sửa") UUID excludeStaffId) {
	}

	public record DuplicateCheckResponse(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Trường bị trùng kèm thông điệp (rỗng = không trùng)") List<FieldIssue> duplicates) {
	}

	public record FieldIssue(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String field,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {
	}

}
