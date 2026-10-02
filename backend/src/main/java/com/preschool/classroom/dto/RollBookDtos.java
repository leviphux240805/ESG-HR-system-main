package com.preschool.classroom.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;

import io.swagger.v3.oas.annotations.media.Schema;

/** Sổ điểm danh tháng của một lớp: trẻ × ngày. */
public final class RollBookDtos {

	private RollBookDtos() {
	}

	public record RollBook(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID classId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày đầu tháng") LocalDate month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<RollBookDay> days,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<RollBookRow> rows) {
	}

	public record RollBookDay(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "1 = thứ Hai … 7 = Chủ nhật") int weekday,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean schoolDay,
			@Schema(description = "Tên ngày lễ") String holiday,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đã chốt điểm danh") boolean locked,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Người xem sửa được ngày này") boolean editable,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int present,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int excused,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int absent) {
	}

	public record RollBookRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày đầu thuộc lớp trong tháng") LocalDate activeFrom,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày cuối thuộc lớp trong tháng") LocalDate activeTo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<LocalDate, AttendanceStatus> cells,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<LocalDate, String> notes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int present,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int excused,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int absent,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Tỷ lệ chuyên cần %: có mặt / số ngày học đã qua khi trẻ thuộc lớp") BigDecimal rate) {
	}

}
