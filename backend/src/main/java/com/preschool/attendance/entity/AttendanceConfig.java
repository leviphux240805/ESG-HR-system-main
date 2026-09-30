package com.preschool.attendance.entity;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcType;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.hibernate.type.descriptor.jdbc.LocalTimeJdbcType;

/**
 * Cấu hình chấm công của cơ sở ({@code schoolId} rỗng = mặc định toàn chuỗi), có hiệu lực từ {@code effectiveFrom}.
 * Chỉ thêm bản mới, không sửa đè (quy tắc 5). Cột giờ ghi thẳng dạng LocalTime ({@code LocalTimeJdbcType}), không qua
 * múi giờ JDBC UTC của Hibernate vốn làm lệch giờ trong ngày.
 */
@Entity
@Table(name = "attendance_configs")
@Filter(name = SchoolFilter.NAME)
@Immutable
public class AttendanceConfig extends BaseEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "effective_from", nullable = false)
	private LocalDate effectiveFrom;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "shift_start", nullable = false)
	private LocalTime shiftStart;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "shift_end", nullable = false)
	private LocalTime shiftEnd;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "lunch_start", nullable = false)
	private LocalTime lunchStart;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "lunch_end", nullable = false)
	private LocalTime lunchEnd;

	@Column(name = "late_grace_minutes", nullable = false)
	private int lateGraceMinutes;

	@Column(name = "max_late_count_allowed", nullable = false)
	private int maxLateCountAllowed;

	/** ISO: 1 = thứ Hai … 7 = Chủ nhật. */
	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "working_weekdays", nullable = false, columnDefinition = "smallint[]")
	private Short[] workingWeekdays;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "half_day_weekdays", nullable = false, columnDefinition = "smallint[]")
	private Short[] halfDayWeekdays;

	@Column(name = "annual_leave_days", nullable = false)
	private BigDecimal annualLeaveDays;

	protected AttendanceConfig() {
	}

	public AttendanceConfig(UUID schoolId, LocalDate effectiveFrom, LocalTime shiftStart, LocalTime shiftEnd,
			LocalTime lunchStart, LocalTime lunchEnd, int lateGraceMinutes, int maxLateCountAllowed,
			Set<DayOfWeek> workingWeekdays, Set<DayOfWeek> halfDayWeekdays, BigDecimal annualLeaveDays) {
		this.schoolId = schoolId;
		this.effectiveFrom = effectiveFrom;
		this.shiftStart = shiftStart;
		this.shiftEnd = shiftEnd;
		this.lunchStart = lunchStart;
		this.lunchEnd = lunchEnd;
		this.lateGraceMinutes = lateGraceMinutes;
		this.maxLateCountAllowed = maxLateCountAllowed;
		this.workingWeekdays = toArray(workingWeekdays);
		this.halfDayWeekdays = toArray(halfDayWeekdays);
		this.annualLeaveDays = annualLeaveDays;
	}

	private static Short[] toArray(Set<DayOfWeek> days) {
		return days.stream().sorted().map(d -> (short) d.getValue()).toArray(Short[]::new);
	}

	private static Set<DayOfWeek> toSet(Short[] values) {
		return Arrays.stream(values).map(v -> DayOfWeek.of(v)).collect(Collectors.toCollection(() -> java.util.EnumSet
			.noneOf(DayOfWeek.class)));
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getEffectiveFrom() {
		return effectiveFrom;
	}

	public LocalTime getShiftStart() {
		return shiftStart;
	}

	public LocalTime getShiftEnd() {
		return shiftEnd;
	}

	public LocalTime getLunchStart() {
		return lunchStart;
	}

	public LocalTime getLunchEnd() {
		return lunchEnd;
	}

	public int getLateGraceMinutes() {
		return lateGraceMinutes;
	}

	public int getMaxLateCountAllowed() {
		return maxLateCountAllowed;
	}

	public Set<DayOfWeek> getWorkingWeekdays() {
		return toSet(workingWeekdays);
	}

	public Set<DayOfWeek> getHalfDayWeekdays() {
		return toSet(halfDayWeekdays);
	}

	public BigDecimal getAnnualLeaveDays() {
		return annualLeaveDays;
	}

}
