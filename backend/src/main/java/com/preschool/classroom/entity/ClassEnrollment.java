package com.preschool.classroom.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Trẻ thuộc lớp nào từ ngày nào. Chuyển lớp hay lên lớp đều đóng dòng cũ ({@code toDate}) rồi mở dòng mới, nên
 * lịch sử lớp của trẻ không mất.
 */
@Entity
@Table(name = "class_enrollments")
@Filter(name = SchoolFilter.NAME)
public class ClassEnrollment extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "class_id", nullable = false)
	private UUID classId;

	@Column(name = "from_date", nullable = false)
	private LocalDate fromDate;

	@Column(name = "to_date")
	private LocalDate toDate;

	private String note;

	protected ClassEnrollment() {
	}

	public ClassEnrollment(UUID schoolId, UUID childId, UUID classId, LocalDate fromDate, String note) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.classId = classId;
		this.fromDate = fromDate;
		this.note = note;
	}

	public void end(LocalDate toDate) {
		this.toDate = toDate.isBefore(fromDate) ? fromDate : toDate;
	}

	public boolean isActive() {
		return toDate == null;
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

	public LocalDate getFromDate() {
		return fromDate;
	}

	public LocalDate getToDate() {
		return toDate;
	}

	public String getNote() {
		return note;
	}

}
