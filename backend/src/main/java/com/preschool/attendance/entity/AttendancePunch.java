package com.preschool.attendance.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/** Giờ vào/ra của máy chấm công cho một nhân viên, một ngày (dạng chữ như trong file: "07:58", "K"). */
@Entity
@Table(name = "attendance_punches")
@Filter(name = SchoolFilter.NAME)
public class AttendancePunch extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "batch_id", nullable = false)
	private UUID batchId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "machine_code", nullable = false)
	private String machineCode;

	@Column(name = "work_date", nullable = false)
	private LocalDate workDate;

	@Column(name = "check_in")
	private String checkIn;

	@Column(name = "check_out")
	private String checkOut;

	protected AttendancePunch() {
	}

	public AttendancePunch(UUID schoolId, UUID staffId, LocalDate workDate) {
		this.schoolId = schoolId;
		this.staffId = staffId;
		this.workDate = workDate;
	}

	/** Lần import sau ghi đè giờ của lần trước. */
	public void update(UUID batchId, String machineCode, String checkIn, String checkOut) {
		this.batchId = batchId;
		this.machineCode = machineCode;
		this.checkIn = checkIn;
		this.checkOut = checkOut;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getBatchId() {
		return batchId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public String getMachineCode() {
		return machineCode;
	}

	public LocalDate getWorkDate() {
		return workDate;
	}

	public String getCheckIn() {
		return checkIn;
	}

	public String getCheckOut() {
		return checkOut;
	}

}
