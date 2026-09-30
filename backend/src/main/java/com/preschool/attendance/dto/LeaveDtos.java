package com.preschool.attendance.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.attendance.entity.LeaveRequest.Status;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Đơn nghỉ phép và phép năm. */
public final class LeaveDtos {

	private LeaveDtos() {
	}

	public record LeaveRequestDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "P, K, O, CO, TS, T, NB") String leaveCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Mã ghi vào bảng công (1/2P khi nửa ngày)") String attendanceCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate toDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean halfDay,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số ngày làm việc trong khoảng") BigDecimal days,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reason,
			FileRef file,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Status status,
			String reviewerName, Instant reviewedAt, String reviewNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canReview,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canCancel) {
	}

	public record CreateLeaveRequest(
			@NotNull @Pattern(regexp = "^(P|K|O|CO|TS|T|NB)$", message = "loại nghỉ không hợp lệ") String leaveCode,
			@NotNull LocalDate fromDate,
			@NotNull LocalDate toDate,
			boolean halfDay,
			@NotBlank @Size(max = 500) String reason,
			UUID fileId) {
	}

	public record LeaveBalanceDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int year,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal annualDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal usedDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đơn phép năm đang chờ duyệt") BigDecimal pendingDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Còn lại (chưa trừ đơn chờ)") BigDecimal remaining) {
	}

	public record ReviewRequest(@Size(max = 500) String note) {
	}

	public record RejectRequest(@NotBlank @Size(max = 500) String note) {
	}

	public record BulkApproveRequest(@NotNull @Size(min = 1, max = 200) List<UUID> ids, @Size(max = 500) String note) {
	}

	public record BulkFailure(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {
	}

	public record BulkApproveResult(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int approved,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<BulkFailure> failed) {
	}

	/** Một đơn đã duyệt trên lịch nghỉ của cơ sở. */
	public record CalendarEntry(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID requestId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String attendanceCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate toDate) {
	}

}
