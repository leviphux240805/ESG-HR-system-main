package com.preschool.classroom.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.TeacherRole;
import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Giáo viên phụ trách lớp; {@code toDate} rỗng = đang phụ trách. Kết thúc phân công thì ghi ngày, giữ lịch sử. */
@Entity
@Table(name = "class_teachers")
@Filter(name = SchoolFilter.NAME)
public class ClassTeacher extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "class_id", nullable = false)
	private UUID classId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private TeacherRole role = TeacherRole.MAIN;

	@Column(name = "from_date", nullable = false)
	private LocalDate fromDate;

	@Column(name = "to_date")
	private LocalDate toDate;

	protected ClassTeacher() {
	}

	public ClassTeacher(UUID schoolId, UUID classId, UUID staffId, TeacherRole role, LocalDate fromDate) {
		this.schoolId = schoolId;
		this.classId = classId;
		this.staffId = staffId;
		this.role = role;
		this.fromDate = fromDate;
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

	public UUID getClassId() {
		return classId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public TeacherRole getRole() {
		return role;
	}

	public LocalDate getFromDate() {
		return fromDate;
	}

	public LocalDate getToDate() {
		return toDate;
	}

}
