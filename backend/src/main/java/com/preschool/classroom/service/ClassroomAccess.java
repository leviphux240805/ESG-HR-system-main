package com.preschool.classroom.service;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.classroom.entity.ClassTeacher;
import com.preschool.classroom.repository.ClassTeacherRepository;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module Lớp học, hồ sơ trẻ, điểm danh (ma trận thiết kế): hiệu trưởng và phó hiệu trưởng nhóm Lớp & trẻ quản
 * lý trường được gán; kế toán, y tế chỉ xem; cấp dưỡng chỉ xem danh sách lớp và sĩ số (không xem hồ sơ trẻ, điểm
 * danh); giáo viên chỉ thấy lớp đang được phân công; nhân viên khác không truy cập. Danh mục chung của tổ chức (năm học, khối) do hiệu trưởng sửa.
 */
@Component
public class ClassroomAccess {

	private static final Set<RoleCode> VIEW_ROLES = EnumSet.of(RoleCode.ACCOUNTANT, RoleCode.NURSE);

	private final ClassTeacherRepository classTeachers;

	public ClassroomAccess(ClassTeacherRepository classTeachers) {
		this.classTeachers = classTeachers;
	}

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	/** Xem mọi lớp, mọi trẻ của trường. */
	public boolean canViewAll(UUID schoolId) {
		return canManage(schoolId) || VIEW_ROLES.stream().anyMatch(r -> scope().hasRoleAt(r, schoolId));
	}

	/** Danh sách lớp, sĩ số: thêm cấp dưỡng. */
	public boolean canViewHeadcount(UUID schoolId) {
		return canViewAll(schoolId) || scope().hasRoleAt(RoleCode.KITCHEN, schoolId);
	}

	public boolean canViewClassSummary(UUID schoolId, UUID classId) {
		return canViewHeadcount(schoolId) || canViewClass(schoolId, classId);
	}

	/** Giáo viên ở trường này (chỉ thấy lớp được phân công). */
	public boolean isTeacherAt(UUID schoolId) {
		return myStaffId() != null && scope().hasRoleAt(RoleCode.TEACHER, schoolId);
	}

	public boolean canViewClass(UUID schoolId, UUID classId) {
		return canViewAll(schoolId) || (isTeacherAt(schoolId) && myClassIds().contains(classId));
	}

	/** Thêm, sửa lớp, xếp lớp, phân công giáo viên, sửa hồ sơ trẻ. */
	public boolean canManage(UUID schoolId) {
		return scope().manages(schoolId, FunctionGroup.CLASSROOM);
	}

	/** Danh mục chung của tổ chức (năm học, khối): hiệu trưởng. */
	public boolean canManageCatalog() {
		return scope().isPrincipal();
	}

	/** Xem danh sách lớp (kể cả cấp dưỡng). */
	public void requireViewAny() {
		if (scope().effectiveSchoolIds().stream().noneMatch(s -> canViewHeadcount(s) || isTeacherAt(s))) {
			throw ApiException.forbidden("CLASSROOM_FORBIDDEN", "Bạn không có quyền xem lớp học.");
		}
	}

	/** Xem hồ sơ trẻ. */
	public void requireViewChildren() {
		if (scope().effectiveSchoolIds().stream().noneMatch(s -> canViewAll(s) || isTeacherAt(s))) {
			throw ApiException.forbidden("CLASSROOM_FORBIDDEN", "Bạn không có quyền xem hồ sơ trẻ.");
		}
	}

	public void requireManage(UUID schoolId) {
		if (!scope().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập trường này.");
		}
		if (!canManage(schoolId)) {
			throw ApiException.forbidden("CLASSROOM_FORBIDDEN", "Bạn không có quyền quản lý lớp học ở trường này.");
		}
	}

	public void requireManageCatalog() {
		if (!canManageCatalog()) {
			throw ApiException.forbidden("CLASSROOM_FORBIDDEN", "Chỉ hiệu trưởng sửa được danh mục chung.");
		}
	}

	/** Lớp tôi đang phụ trách. */
	public Set<UUID> myClassIds() {
		UUID staffId = myStaffId();
		if (staffId == null) {
			return Set.of();
		}
		return classTeachers.findByStaffIdAndToDateIsNull(staffId)
			.stream()
			.map(ClassTeacher::getClassId)
			.collect(Collectors.toSet());
	}

	public UUID myStaffId() {
		return scope().access().staffId();
	}

	/** Trường đang chọn; bắt buộc chọn một trường khi tạo dữ liệu mới. */
	public UUID requireSelectedSchool() {
		UUID id = scope().selectedSchoolId();
		if (id == null) {
			throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn một trường.");
		}
		return id;
	}

}
