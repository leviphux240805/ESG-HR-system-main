package com.preschool.attendance.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Immutable;

/** Công tháng của cơ sở đã khóa (trước khi tính lương); mở khóa = xóa dòng (ghi audit). */
@Entity
@Table(name = "attendance_month_locks")
@Filter(name = SchoolFilter.NAME)
@Immutable
public class AttendanceMonthLock extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(nullable = false)
	private LocalDate month;

	@Column(name = "locked_at", nullable = false)
	private Instant lockedAt;

	@Column(name = "locked_by", nullable = false)
	private UUID lockedBy;

	protected AttendanceMonthLock() {
	}

	public AttendanceMonthLock(UUID schoolId, LocalDate month, Instant lockedAt, UUID lockedBy) {
		this.schoolId = schoolId;
		this.month = month;
		this.lockedAt = lockedAt;
		this.lockedBy = lockedBy;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getMonth() {
		return month;
	}

	public Instant getLockedAt() {
		return lockedAt;
	}

	public UUID getLockedBy() {
		return lockedBy;
	}

}
