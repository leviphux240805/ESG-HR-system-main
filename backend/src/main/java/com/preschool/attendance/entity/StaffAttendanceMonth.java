package com.preschool.attendance.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/** Tổng công tháng của nhân viên, chốt khi khóa công (bảng lương giai đoạn 4 đọc từ đây). */
@Entity
@Table(name = "staff_attendance_months")
@Filter(name = SchoolFilter.NAME)
public class StaffAttendanceMonth extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(nullable = false)
	private LocalDate month;

	@Column(name = "total_work", nullable = false)
	private BigDecimal totalWork;

	@Column(name = "paid_leave", nullable = false)
	private BigDecimal paidLeave;

	@Column(name = "unpaid_leave", nullable = false)
	private BigDecimal unpaidLeave;

	@Column(name = "holiday_leave", nullable = false)
	private BigDecimal holidayLeave;

	@Column(name = "late_count", nullable = false)
	private int lateCount;

	@Column(name = "locked_at")
	private Instant lockedAt;

	protected StaffAttendanceMonth() {
	}

	public StaffAttendanceMonth(UUID schoolId, UUID staffId, LocalDate month) {
		this.schoolId = schoolId;
		this.staffId = staffId;
		this.month = month;
	}

	public void setTotals(BigDecimal totalWork, BigDecimal paidLeave, BigDecimal unpaidLeave, BigDecimal holidayLeave,
			int lateCount, Instant lockedAt) {
		this.totalWork = totalWork;
		this.paidLeave = paidLeave;
		this.unpaidLeave = unpaidLeave;
		this.holidayLeave = holidayLeave;
		this.lateCount = lateCount;
		this.lockedAt = lockedAt;
	}

	public void unlock() {
		this.lockedAt = null;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public LocalDate getMonth() {
		return month;
	}

	public BigDecimal getTotalWork() {
		return totalWork;
	}

	public BigDecimal getPaidLeave() {
		return paidLeave;
	}

	public BigDecimal getUnpaidLeave() {
		return unpaidLeave;
	}

	public BigDecimal getHolidayLeave() {
		return holidayLeave;
	}

	public int getLateCount() {
		return lateCount;
	}

	public Instant getLockedAt() {
		return lockedAt;
	}

}
