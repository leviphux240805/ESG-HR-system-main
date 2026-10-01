package com.preschool.classroom.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.staff.dto.StaffRecordDtos.DocumentTypeDto;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Hồ sơ trẻ, phụ huynh và người được đón, giấy tờ, lịch sử lớp. */
public final class ChildDtos {

	private ChildDtos() {
	}

	/** Bộ lọc danh sách trẻ (trong phạm vi cơ sở đang chọn). */
	public record ChildQuery(
			@Schema(description = "Tìm theo tên, tên ở nhà, mã trẻ") String q,
			UUID classId,
			ChildStatus status,
			Gender gender) {
	}

	public record ChildItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			String nickname,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Gender gender,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate dob,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ChildStatus status,
			UUID classId,
			String className,
			String guardianName,
			String guardianPhone,
			String allergyNote) {
	}

	public record ChildProfileRequest(
			@NotBlank(message = "Vui lòng nhập họ tên trẻ.") @Size(max = 150, message = "Họ tên tối đa 150 ký tự.") String fullName,
			@Size(max = 50, message = "Tên ở nhà tối đa 50 ký tự.") String nickname,
			@NotNull(message = "Vui lòng nhập ngày sinh.") @Past(message = "Ngày sinh phải trước hôm nay.") LocalDate dob,
			@NotNull(message = "Vui lòng chọn giới tính.") Gender gender,
			@Pattern(regexp = "^$|^\\d{12}$", message = "Mã định danh gồm 12 chữ số.") String personalId,
			@Size(max = 20, message = "Số thẻ BHYT tối đa 20 ký tự.") String healthInsuranceNo,
			@Size(max = 5) String provinceCode,
			@Size(max = 10) String wardCode,
			@Size(max = 300) String addressDetail,
			@Size(max = 500, message = "Ghi chú dị ứng tối đa 500 ký tự.") String allergyNote,
			@Size(max = 1000, message = "Lưu ý sức khỏe tối đa 1000 ký tự.") String healthNote,
			UUID photoFileId) {
	}

	public record CreateChildRequest(
			@NotNull @Valid ChildProfileRequest profile,
			@NotNull(message = "Vui lòng chọn ngày nhập học.") LocalDate enrolledAt,
			@Schema(description = "Lớp xếp vào từ ngày nhập học; rỗng = chưa xếp lớp") UUID classId,
			@Valid List<GuardianRequest> guardians) {
	}

	public record GuardianRequest(
			@Schema(description = "Phụ huynh đã có trong cơ sở (anh chị em học cùng); rỗng = tạo mới") UUID guardianId,
			@Size(max = 150, message = "Họ tên tối đa 150 ký tự.") String fullName,
			@Pattern(regexp = "^$|^0\\d{9}$", message = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.") String phone,
			@Email(message = "Email không hợp lệ.") @Size(max = 255) String email,
			@Size(max = 20) String citizenId,
			@Size(max = 100) String job,
			@NotBlank(message = "Vui lòng nhập quan hệ với trẻ.") @Size(max = 50) String relationship,
			@Schema(description = "Người liên hệ chính; rỗng = không") Boolean primary,
			@Schema(description = "Được đón trẻ; rỗng = có") Boolean canPickUp,
			@Size(max = 300) String note) {

		public boolean isPrimary() {
			return Boolean.TRUE.equals(primary);
		}

		public boolean pickUp() {
			return !Boolean.FALSE.equals(canPickUp);
		}

	}

	public record GuardianDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Id liên kết trẻ – phụ huynh") UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID guardianId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			String phone,
			String email,
			String citizenId,
			String job,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String relationship,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean primary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canPickUp,
			String note) {
	}

	/** Phụ huynh đã có trong cơ sở, tìm theo số điện thoại để gắn cho anh chị em. */
	public record GuardianMatch(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			String phone,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> childNames) {
	}

	public record EnrollmentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID classId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromDate,
			LocalDate toDate,
			String note) {
	}

	public record ChildDocumentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) DocumentTypeDto type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) FileRef file,
			LocalDate issuedDate,
			LocalDate expiryDate,
			String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
	}

	public record ChildDocumentRequest(
			@NotNull(message = "Vui lòng chọn loại giấy tờ.") UUID documentTypeId,
			@NotNull(message = "Vui lòng tải tệp lên.") UUID fileId,
			LocalDate issuedDate,
			LocalDate expiryDate,
			@Size(max = 300) String note) {
	}

	public record ChildDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ChildItem item,
			String personalId,
			String healthInsuranceNo,
			String provinceCode,
			String wardCode,
			String addressDetail,
			String healthNote,
			FileRef photo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate enrolledAt,
			LocalDate leftAt,
			String leftReason,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<GuardianDto> guardians,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Lịch sử lớp, mới nhất trước") List<EnrollmentDto> enrollments,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ChildDocumentDto> documents,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit) {
	}

	public record ChildStatusRequest(
			@NotNull(message = "Vui lòng chọn trạng thái.") ChildStatus status,
			@Schema(description = "Ngày hiệu lực; rỗng = hôm nay") LocalDate date,
			@Size(max = 300) String reason) {
	}

	public record TransferRequest(
			@NotNull(message = "Vui lòng chọn lớp.") UUID classId,
			@Schema(description = "Vào lớp mới từ ngày; rỗng = hôm nay") LocalDate fromDate,
			@Size(max = 300) String note) {
	}

}
