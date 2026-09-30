package com.preschool.attendance.entity;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.type.descriptor.jdbc.LocalTimeJdbcType;

/**
 * Bảng công một ngày của nhân viên: mã công (rỗng = chưa chấm) và kết quả đối soát với máy chấm công (phút muộn, có
 * tính muộn, sai lệch, gợi ý).
 */
@Entity
@Table(name = "staff_attendance_days")
@Filter(name = SchoolFilter.NAME)
public class StaffAttendanceDay extends BaseEntity {

	/** Nguồn của mã công: chấm tay, tự điền từ máy, hay từ đơn nghỉ đã duyệt. */
	public enum Source {
		MANUAL, MACHINE, LEAVE
	}

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "work_date", nullable = false)
	private LocalDate workDate;

	@Column(name = "status_code")
	private String statusCode;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Source source = Source.MANUAL;

	@Column(name = "late_minutes", nullable = false)
	private int lateMinutes;

	@Column(name = "is_counted_late", nullable = false)
	private boolean countedLate;

	@Column(name = "is_discrepancy", nullable = false)
	private boolean discrepancy;

	@Column(name = "discrepancy_reason")
	private String discrepancyReason;

	@Column(name = "suggested_status")
	private String suggestedStatus;

	private String note;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "leave_time")
	private LocalTime leaveTime;

	@JdbcType(LocalTimeJdbcType.class)
	@Column(name = "return_time")
	private LocalTime returnTime;

	@Column(name = "confirmed_by")
	private UUID confirmedBy;

	protected StaffAttendanceDay() {
	}

	public StaffAttendanceDay(UUID schoolId, UUID staffId, LocalDate workDate) {
		this.schoolId = schoolId;
		this.staffId = staffId;
		this.workDate = workDate;
	}

	/** Ghi kết quả đối soát (không đổi mã công). */
	public void applyReconciliation(int lateMinutes, boolean countedLate, boolean discrepancy, String reason,
			String suggestedStatus) {
		this.lateMinutes = lateMinutes;
		this.countedLate = countedLate;
		this.discrepancy = discrepancy;
		this.discrepancyReason = reason;
		this.suggestedStatus = suggestedStatus;
	}

	/** Đặt mã công; người sửa đã xem nên bỏ cờ sai lệch. */
	public void setStatus(String statusCode, Source source, UUID confirmedBy) {
		this.statusCode = statusCode;
		this.source = source;
		this.confirmedBy = confirmedBy;
		this.discrepancy = false;
	}

	public void setDetails(String note, LocalTime leaveTime, LocalTime returnTime) {
		this.note = note;
		this.leaveTime = leaveTime;
		this.returnTime = returnTime;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public LocalDate getWorkDate() {
		return workDate;
	}

	public String getStatusCode() {
		return statusCode;
	}

	public Source getSource() {
		return source;
	}

	public int getLateMinutes() {
		return lateMinutes;
	}

	public boolean isCountedLate() {
		return countedLate;
	}

	public boolean isDiscrepancy() {
		return discrepancy;
	}

	public String getDiscrepancyReason() {
		return discrepancyReason;
	}

	public String getSuggestedStatus() {
		return suggestedStatus;
	}

	public String getNote() {
		return note;
	}

	public LocalTime getLeaveTime() {
		return leaveTime;
	}

	public LocalTime getReturnTime() {
		return returnTime;
	}

	public UUID getConfirmedBy() {
		return confirmedBy;
	}

}
