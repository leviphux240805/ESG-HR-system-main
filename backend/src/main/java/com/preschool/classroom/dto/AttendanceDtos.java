package com.preschool.classroom.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.classroom.entity.ClassEnums.Gender;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Điểm danh trẻ theo lớp và ngày. */
public final class AttendanceDtos {

	private AttendanceDtos() {
	}

	public record PickUpPerson(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID guardianId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String relationship) {
	}

	public record RollCallRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			String nickname,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Gender gender,
			String allergyNote,
			@Schema(description = "Rỗng = chưa điểm danh") AttendanceStatus status,
			LocalTime checkInTime,
			LocalTime checkOutTime,
			UUID pickedUpBy,
			String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PickUpPerson> pickUps) {
	}

	public record RollCallSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int total,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int present,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int excused,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int absent,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int unmarked) {
	}

	public record RollCall(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID classId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Không phải Chủ nhật hoặc ngày lễ") boolean schoolDay,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Giờ báo ăn; giáo viên không sửa sau giờ này") LocalTime mealCutoffTime,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đã chốt: không ai sửa cho tới khi mở lại") boolean locked,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Người xem được điểm danh/sửa lúc này") boolean canEdit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canUnlock,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) RollCallSummary summary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<RollCallRow> rows) {
	}

	public record MarkRow(
			@NotNull UUID childId,
			@NotNull(message = "Vui lòng chọn trạng thái.") AttendanceStatus status,
			@Schema(description = "Giờ đến; rỗng = giờ hiện tại nếu điểm danh trong ngày") LocalTime checkInTime,
			LocalTime checkOutTime,
			@Schema(description = "Người đón, trong số người được phép đón") UUID pickedUpBy,
			@Size(max = 300) String note) {
	}

	public record MarkRequest(
			@NotNull(message = "Vui lòng chọn ngày.") LocalDate date,
			@NotEmpty(message = "Chưa có trẻ nào được điểm danh.") @Valid List<MarkRow> rows) {
	}

	public record RollCallLockRequest(@NotNull(message = "Vui lòng chọn ngày.") LocalDate date) {
	}

	public record RollCallUnlockRequest(
			@NotNull(message = "Vui lòng chọn ngày.") LocalDate date,
			@NotNull(message = "Vui lòng nhập lý do mở lại.") @Size(min = 3, max = 300, message = "Lý do từ 3 đến 300 ký tự.") String reason) {
	}

}
