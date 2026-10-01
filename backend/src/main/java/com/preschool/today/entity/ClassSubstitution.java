package com.preschool.today.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Người dạy thay giáo viên nghỉ ở một lớp trong một ngày. */
@Entity
@Table(name = "class_substitutions")
@Filter(name = SchoolFilter.NAME)
public class ClassSubstitution extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "sub_date", nullable = false)
	private LocalDate date;

	@Column(name = "class_id", nullable = false)
	private UUID classId;

	@Column(name = "absent_staff_id", nullable = false)
	private UUID absentStaffId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	protected ClassSubstitution() {
	}

	public ClassSubstitution(UUID schoolId, LocalDate date, UUID classId, UUID absentStaffId, UUID staffId) {
		this.schoolId = schoolId;
		this.date = date;
		this.classId = classId;
		this.absentStaffId = absentStaffId;
		this.staffId = staffId;
	}

	public void reassign(UUID staffId) {
		this.staffId = staffId;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getDate() {
		return date;
	}

	public UUID getClassId() {
		return classId;
	}

	public UUID getAbsentStaffId() {
		return absentStaffId;
	}

	public UUID getStaffId() {
		return staffId;
	}

}
