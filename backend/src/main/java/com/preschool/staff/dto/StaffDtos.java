package com.preschool.staff.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
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
			@Schema(description = "Link ảnh có hạn (vài phút) để hiển thị") String photoUrl,
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
			@Schema(description = "Mã nhân viên trên máy chấm công của cơ sở") String machineCode,
			String socialInsuranceNo,
			String healthInsuranceNo,
			String personalTaxCode,
			UUID photoFileId,
			@Schema(description = "Link ảnh có hạn (vài phút) để hiển thị") String photoUrl,
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
			String email,
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
			@Pattern(regexp = "^[A-Za-z0-9._-]{1,30}$", message = "mã chấm công chỉ gồm chữ, số, dấu chấm, gạch") String machineCode,
			@Size(max = 20) String socialInsuranceNo,
			@Size(max = 20) String healthInsuranceNo,
			@Size(max = 15) String personalTaxCode,
			UUID photoFileId,
			@NotNull LocalDate startDate) {
	}

	/** Tạo tài khoản đăng nhập (bằng email hoặc SĐT của hồ sơ) cùng lúc với hồ sơ (chỉ hiệu trưởng). */
	public record NewAccount(
			@Schema(description = "Vai trò kèm trường")
			@NotNull @Size(min = 1) List<@Valid RoleAssignment> roles,
			@Schema(description = "Mật khẩu ban đầu: ít nhất 8 ký tự, gồm cả chữ và số") @NotBlank @Size(max = 200) String password) {
	}

	public record RoleAssignment(@NotNull(message = "Vui lòng chọn vai trò.") RoleCode role,
			@NotNull(message = "Vui lòng chọn trường.") UUID schoolId,
			@Schema(description = "Nhóm chức năng, chỉ dùng cho phó hiệu trưởng") java.util.Set<FunctionGroup> functionGroups) {
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

	/** Một giấy tờ sắp hết hạn; `tab` là tab hồ sơ cần mở (contracts, qualifications, documents). */
	public record ExpiringItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID recordId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate expiryDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long daysLeft,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String tab) {
	}

	public record FieldIssue(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String field,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {
	}

}
