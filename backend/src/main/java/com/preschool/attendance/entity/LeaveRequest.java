package com.preschool.attendance.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/** Đơn xin nghỉ theo mã công; duyệt xong ghi mã vào bảng công và trừ phép (nếu là phép năm). */
@Entity
@Table(name = "leave_requests")
@Filter(name = SchoolFilter.NAME)
public class LeaveRequest extends BaseEntity {

	public enum Status {
		PENDING, APPROVED, REJECTED, CANCELLED
	}

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "leave_code", nullable = false)
	private String leaveCode;

	@Column(name = "from_date", nullable = false)
	private LocalDate fromDate;

	@Column(name = "to_date", nullable = false)
	private LocalDate toDate;

	@Column(name = "half_day", nullable = false)
	private boolean halfDay;

	@Column(nullable = false)
	private BigDecimal days;

	@Column(nullable = false)
	private String reason;

	@Column(name = "file_id")
	private UUID fileId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status = Status.PENDING;

	@Column(name = "approved_by")
	private UUID reviewedBy;

	@Column(name = "approved_at")
	private Instant reviewedAt;

	@Column(name = "review_note")
	private String reviewNote;

	protected LeaveRequest() {
	}

	public LeaveRequest(UUID schoolId, UUID staffId, String leaveCode, LocalDate fromDate, LocalDate toDate,
			boolean halfDay, BigDecimal days, String reason, UUID fileId) {
		this.schoolId = schoolId;
		this.staffId = staffId;
		this.leaveCode = leaveCode;
		this.fromDate = fromDate;
		this.toDate = toDate;
		this.halfDay = halfDay;
		this.days = days;
		this.reason = reason;
		this.fileId = fileId;
	}

	public void review(Status status, UUID reviewer, Instant at, String note) {
		this.status = status;
		this.reviewedBy = reviewer;
		this.reviewedAt = at;
		this.reviewNote = note;
	}

	public void cancel() {
		this.status = Status.CANCELLED;
	}

	/** Mã công ghi vào bảng công: nửa ngày thành 1/2P, 1/2K. */
	public String attendanceCode() {
		return halfDay ? "1/2" + leaveCode : leaveCode;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public String getLeaveCode() {
		return leaveCode;
	}

	public LocalDate getFromDate() {
		return fromDate;
	}

	public LocalDate getToDate() {
		return toDate;
	}

	public boolean isHalfDay() {
		return halfDay;
	}

	public BigDecimal getDays() {
		return days;
	}

	public String getReason() {
		return reason;
	}

	public UUID getFileId() {
		return fileId;
	}

	public Status getStatus() {
		return status;
	}

	public UUID getReviewedBy() {
		return reviewedBy;
	}

	public Instant getReviewedAt() {
		return reviewedAt;
	}

	public String getReviewNote() {
		return reviewNote;
	}

}
