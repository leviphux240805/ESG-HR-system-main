package com.preschool.attendance.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Bảng công tháng, import máy chấm công, xử lý sai lệch. */
public final class AttendanceDtos {

	private AttendanceDtos() {
	}

	public static final String MONTH_PATTERN = "^\\d{4}-(0[1-9]|1[0-2])$";

	// ---- bảng công tháng

	public record DayInfo(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "1 = thứ Hai … 7 = Chủ nhật") int weekday,
			@Schema(description = "Tên ngày lễ (rỗng = không phải lễ)") String holiday,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean working,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean halfDay) {
	}

	/** Một ô bảng công; chỉ có với ngày có mã hoặc có kết quả đối soát. */
	public record Cell(
			@Schema(description = "Mã công; rỗng = chưa chấm") String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String source,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean discrepancy,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int lateMinutes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean countedLate,
			String note) {
	}

	public record Totals(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal totalWork,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal paidLeave,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal unpaidLeave,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal holidayLeave,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int lateCount) {
	}

	public record StaffRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String position,
			String machineCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày đầu thuộc cơ sở trong tháng") LocalDate activeFrom,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate activeTo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ô theo ngày yyyy-MM-dd") Map<String, Cell> cells,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Totals totals) {
	}

	public record LockInfo(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant lockedAt,
			String lockedByName) {
	}

	public record MonthSheet(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "2026-09") String month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(description = "Rỗng = chưa khóa") LockInfo lock,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManage,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Mở khóa: văn phòng điều hành") boolean canUnlock,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DayInfo> days,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<StaffRow> staff,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int discrepancyCount) {
	}

	/** Bảng công tháng của chính người đang đăng nhập. */
	public record MySheet(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "2026-09") String month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DayInfo> days,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<String, Cell> cells,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Totals totals,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean locked) {
	}

	// ---- sửa một ô

	public record CellDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			String code, String source, String checkIn, String checkOut,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean discrepancy,
			String discrepancyReason, String suggestedStatus,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int lateMinutes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean countedLate,
			String note,
			@Schema(type = "string", example = "09:30") LocalTime leaveTime,
			@Schema(type = "string", example = "10:15") LocalTime returnTime,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean locked) {
	}

	public record UpdateCellRequest(
			@Schema(description = "Mã công; rỗng = xóa mã") String code,
			@Size(max = 500) String note,
			@Schema(type = "string", example = "09:30", description = "Giờ ra giữa ca") LocalTime leaveTime,
			@Schema(type = "string", example = "10:15", description = "Giờ vào lại") LocalTime returnTime) {
	}

	public record UnlockRequest(@NotBlank @Size(max = 500) String reason) {
	}

	// ---- import

	public record ImportRow(
			@NotBlank @Size(max = 30) String machineCode,
			@Size(max = 200) String name,
			@NotNull LocalDate workDate,
			@Size(max = 10) String checkIn,
			@Size(max = 10) String checkOut) {
	}

	public record ImportRequest(
			@NotNull @Pattern(regexp = MONTH_PATTERN, message = "tháng dạng yyyy-MM") String month,
			@Schema(description = "File Excel gốc đã upload (lưu làm chứng từ)") UUID fileId,
			@NotNull @Size(min = 1, max = 20000) List<@Valid ImportRow> rows) {
	}

	public record UnmatchedCode(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String machineCode,
			String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int rows) {
	}

	public record ImportResult(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID batchId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int rowCount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int matchedRows,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int staffCount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UnmatchedCode> unmatched,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int discrepancyCount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số ngày tự điền X/K từ máy") int autoFilled) {
	}

	// ---- sai lệch

	public record DiscrepancyItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			String checkIn, String checkOut, String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reason,
			String suggestedStatus) {
	}

	public record ResolveItem(@NotNull UUID staffId, @NotNull LocalDate date, @NotBlank String code) {
	}

	public record ResolveRequest(
			@NotNull @Pattern(regexp = MONTH_PATTERN, message = "tháng dạng yyyy-MM") String month,
			@NotNull @Size(min = 1, max = 5000) List<@Valid ResolveItem> items) {
	}

}
