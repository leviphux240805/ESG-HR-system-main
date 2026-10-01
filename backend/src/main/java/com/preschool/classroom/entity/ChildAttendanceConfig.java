package com.preschool.classroom.entity;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcType;
import org.hibernate.type.descriptor.jdbc.LocalTimeJdbcType;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Giờ báo ăn của cơ sở: qua giờ này bảng điểm danh trong ngày tự khóa để cấp dưỡng chốt số suất. Chỉ thêm bản mới
 * theo {@code effectiveFrom}, không sửa đè (quy tắc 5). {@code schoolId} rỗng = mặc định của tổ chức.
 */
@Entity
@Table(name = "child_attendance_configs")
@Filter(name = OrganizationFilter.NAME)
@Immutable
public class ChildAttendanceConfig extends OrganizationEntity {

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
