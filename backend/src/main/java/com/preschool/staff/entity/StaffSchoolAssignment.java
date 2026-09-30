package com.preschool.staff.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Một giai đoạn làm việc tại một cơ sở. Không gắn filter cơ sở: lịch sử luôn đầy đủ, truy cập qua hồ sơ nhân viên
 * (đã được lọc). Bảng công và lương các tháng trước dựa vào đây để tính về đúng cơ sở cũ.
 */
@Entity
@Table(name = "staff_school_assignments")
public class StaffSchoolAssignment extends BaseEntity {

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "from_date", nullable = false)
	private LocalDate fromDate;

	@Column(name = "to_date")
	private LocalDate toDate;

	@Column(name = "decision_file_id")
	private UUID decisionFileId;

	private String note;

	protected StaffSchoolAssignment() {
	}

	public StaffSchoolAssignment(UUID staffId, UUID schoolId, LocalDate fromDate, UUID decisionFileId, String note) {
		this.staffId = staffId;
		this.schoolId = schoolId;
		this.fromDate = fromDate;
		this.decisionFileId = decisionFileId;
		this.note = note;
	}

	public void close(LocalDate toDate) {
		this.toDate = toDate;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getFromDate() {
		return fromDate;
	}

	public LocalDate getToDate() {
		return toDate;
	}

	public UUID getDecisionFileId() {
		return decisionFileId;
	}

	public String getNote() {
		return note;
	}

}
