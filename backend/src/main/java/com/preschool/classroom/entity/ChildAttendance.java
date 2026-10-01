package com.preschool.classroom.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Điểm danh trẻ một ngày. Đã chốt ({@code lockedAt}) thì giáo viên không sửa nữa; hiệu trưởng mở lại kèm lý do
 * (ghi nhật ký thao tác).
 */
@Entity
@Table(name = "child_attendance")
@Filter(name = SchoolFilter.NAME)
public class ChildAttendance extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "class_id", nullable = false)
	private UUID classId;

	@Column(name = "attend_date", nullable = false)
	private LocalDate attendDate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AttendanceStatus status;

	@Column(name = "check_in_at")
	private Instant checkInAt;

	@Column(name = "check_out_at")
	private Instant checkOutAt;

	@Column(name = "picked_up_by")
	private UUID pickedUpBy;

	private String note;

	@Column(name = "locked_at")
	private Instant lockedAt;

	protected ChildAttendance() {
	}

	public ChildAttendance(UUID schoolId, UUID childId, UUID classId, LocalDate attendDate, AttendanceStatus status) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.classId = classId;
		this.attendDate = attendDate;
		this.status = status;
	}

	public void mark(AttendanceStatus status, UUID classId, String note, Instant checkInAt) {
		this.status = status;
		this.classId = classId;
		this.note = note;
		if (status == AttendanceStatus.PRESENT) {
			if (this.checkInAt == null) {
				this.checkInAt = checkInAt;
			}
		}
		else {
			this.checkInAt = null;
			this.checkOutAt = null;
			this.pickedUpBy = null;
		}
	}

	/** Trả trẻ: giờ về và người đón (không bắt buộc). */
	public void pickUp(Instant at, UUID guardianId) {
		this.checkOutAt = at;
		this.pickedUpBy = guardianId;
	}

	/** Sửa giờ đến (giáo viên nhập bù khi điểm danh muộn). */
	public void checkIn(Instant at) {
		this.checkInAt = at;
	}

	public void lock(Instant at) {
		this.lockedAt = at;
	}

	public void unlock() {
		this.lockedAt = null;
	}

	public boolean isLocked() {
		return lockedAt != null;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getChildId() {
		return childId;
	}

	public UUID getClassId() {
		return classId;
	}

	public LocalDate getAttendDate() {
		return attendDate;
	}

	public AttendanceStatus getStatus() {
		return status;
	}

	public Instant getCheckInAt() {
		return checkInAt;
	}

	public Instant getCheckOutAt() {
		return checkOutAt;
	}

	public UUID getPickedUpBy() {
		return pickedUpBy;
	}

	public String getNote() {
		return note;
	}

	public Instant getLockedAt() {
		return lockedAt;
	}

}
