package com.preschool.classroom.entity;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcType;
import org.hibernate.type.descriptor.jdbc.LocalTimeJdbcType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Giờ báo ăn của cơ sở: qua giờ này bảng điểm danh trong ngày tự khóa để cấp dưỡng chốt số suất. Chỉ thêm bản mới
 * theo {@code effectiveFrom}, không sửa đè (quy tắc 5). {@code schoolId} rỗng = mặc định toàn chuỗi.
 */
@Entity
@Table(name = "child_attendance_configs")
@Immutable
public class ChildAttendanceConfig extends BaseEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "effective_from", nullable = false)
	private LocalDate effectiveFrom;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "meal_cutoff_time", nullable = false)
	private LocalTime mealCutoffTime;

	protected ChildAttendanceConfig() {
	}

	public ChildAttendanceConfig(UUID schoolId, LocalDate effectiveFrom, LocalTime mealCutoffTime) {
		this.schoolId = schoolId;
		this.effectiveFrom = effectiveFrom;
		this.mealCutoffTime = mealCutoffTime;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getEffectiveFrom() {
		return effectiveFrom;
	}

	public LocalTime getMealCutoffTime() {
		return mealCutoffTime;
	}

}
