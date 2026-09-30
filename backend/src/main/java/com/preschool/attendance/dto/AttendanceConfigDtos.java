package com.preschool.attendance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cấu hình chấm công và ngày lễ. */
public final class AttendanceConfigDtos {

	private AttendanceConfigDtos() {
	}

	public record ConfigDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = mặc định toàn chuỗi") UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate effectiveFrom,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, type = "string", example = "07:30") LocalTime shiftStart,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, type = "string", example = "17:00") LocalTime shiftEnd,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, type = "string", example = "11:30") LocalTime lunchStart,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, type = "string", example = "13:00") LocalTime lunchEnd,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int graceMinutes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int maxLateAllowed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "1 = thứ Hai … 7 = Chủ nhật") List<Integer> workingWeekdays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Integer> halfDayWeekdays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal annualLeaveDays) {
	}

	public record ConfigOverview(
			@Schema(description = "Bản đang áp dụng hôm nay (của cơ sở, không có thì mặc định toàn chuỗi)") ConfigDto effective,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Các bản của cơ sở và toàn chuỗi, mới nhất trước") List<ConfigDto> versions,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManage) {
	}

	public record CreateConfigRequest(
			@Schema(description = "Bỏ trống = mặc định toàn chuỗi (văn phòng điều hành)") UUID schoolId,
			@NotNull LocalDate effectiveFrom,
			@NotNull @Schema(type = "string", example = "07:30") LocalTime shiftStart,
			@NotNull @Schema(type = "string", example = "17:00") LocalTime shiftEnd,
			@NotNull @Schema(type = "string", example = "11:30") LocalTime lunchStart,
			@NotNull @Schema(type = "string", example = "13:00") LocalTime lunchEnd,
			@NotNull @Min(0) @Max(240) Integer graceMinutes,
			@NotNull @Min(0) @Max(31) Integer maxLateAllowed,
			@NotEmpty List<@Min(1) @Max(7) Integer> workingWeekdays,
			@NotNull List<@Min(1) @Max(7) Integer> halfDayWeekdays,
			@NotNull @DecimalMin("0") @DecimalMax("60") BigDecimal annualLeaveDays) {
	}

	public record HolidayDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = toàn chuỗi") UUID schoolId,
			String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManage) {
	}

	public record CreateHolidayRequest(
			@Schema(description = "Bỏ trống = toàn chuỗi (văn phòng điều hành)") UUID schoolId,
			@NotNull LocalDate fromDate,
			@Schema(description = "Bỏ trống = một ngày") LocalDate toDate,
			@NotBlank @Size(max = 200) String name) {
	}

}
