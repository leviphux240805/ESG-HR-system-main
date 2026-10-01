package com.preschool.health.service;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.classroom.service.ClassroomAccess;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module Thực đơn & sức khỏe (ma trận thiết kế): hiệu trưởng và phó hiệu trưởng nhóm Thực đơn & sức khỏe, y tế
 * cả trường; cấp dưỡng chỉ thực đơn; giáo viên xem thực đơn, cân đo và ghi sổ theo dõi lớp được phân công.
 * TODO(assumption): cấp dưỡng, y tế sửa thực đơn trường mình; món dùng chung của tổ chức do hiệu trưởng quản lý;
 * y tế, giáo viên chủ nhiệm nhập cân đo.
 */
@Component
public class HealthAccess {

	private static final Set<RoleCode> MENU_EDIT = EnumSet.of(RoleCode.NURSE, RoleCode.KITCHEN);

	private final ClassroomAccess classroom;

	public HealthAccess(ClassroomAccess classroom) {
		this.classroom = classroom;
	}

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	private static boolean any(Set<RoleCode> roles, UUID schoolId) {
		return roles.stream().anyMatch(r -> scope().hasRoleAt(r, schoolId));
	}

	// ------------------------------------------------------------ thực đơn

	public boolean canViewMenu(UUID schoolId) {
		return canEditMenu(schoolId) || scope().hasRoleAt(RoleCode.TEACHER, schoolId);
	}

	public boolean canEditMenu(UUID schoolId) {
		return scope().manages(schoolId, FunctionGroup.NUTRITION) || any(MENU_EDIT, schoolId);
	}

	public boolean canManageSharedDishes() {
		return scope().isPrincipal();
	}

	public void requireViewMenu(UUID schoolId) {
		requireSchool(schoolId);
		if (!canViewMenu(schoolId)) {
			throw ApiException.forbidden("MENU_FORBIDDEN", "Bạn không có quyền xem thực đơn.");
		}
	}

	public void requireEditMenu(UUID schoolId) {
		requireSchool(schoolId);
		if (!canEditMenu(schoolId)) {
			throw ApiException.forbidden("MENU_FORBIDDEN", "Bạn không có quyền sửa thực đơn ở trường này.");
		}
	}

	public void requireManageSharedDishes() {
		if (!canManageSharedDishes()) {
			throw ApiException.forbidden("MENU_FORBIDDEN", "Chỉ hiệu trưởng sửa được món dùng chung của tổ chức.");
		}
	}

	public void requireViewMenuAny() {
		if (scope().effectiveSchoolIds().stream().noneMatch(this::canViewMenu)) {
			throw ApiException.forbidden("MENU_FORBIDDEN", "Bạn không có quyền xem thực đơn.");
		}
	}

	// ------------------------------------------------------------ sức khỏe

	public boolean canViewAllHealth(UUID schoolId) {
		return canEditAllHealth(schoolId);
	}

	public boolean canEditAllHealth(UUID schoolId) {
		return scope().manages(schoolId, FunctionGroup.NUTRITION) || scope().hasRoleAt(RoleCode.NURSE, schoolId);
	}

	/** Xem sức khỏe trẻ của lớp: người xem toàn cơ sở hoặc giáo viên đang phụ trách lớp. */
	public boolean canViewClass(UUID schoolId, UUID classId) {
		return canViewAllHealth(schoolId) || isTeacherOf(schoolId, classId);
	}

	public boolean canEditClass(UUID schoolId, UUID classId) {
		return canEditAllHealth(schoolId) || isTeacherOf(schoolId, classId);
	}

	public boolean canViewAny() {
		return scope().effectiveSchoolIds()
			.stream()
			.anyMatch(s -> canViewAllHealth(s) || classroom.isTeacherAt(s));
	}

	public void requireViewAny() {
		if (!canViewAny()) {
			throw ApiException.forbidden("HEALTH_FORBIDDEN", "Bạn không có quyền xem sức khỏe trẻ.");
		}
	}

	public void requireEditClass(UUID schoolId, UUID classId) {
		if (!canEditClass(schoolId, classId)) {
			throw ApiException.forbidden("HEALTH_FORBIDDEN", "Bạn không có quyền ghi sức khỏe trẻ của lớp này.");
		}
	}

	public Set<UUID> myClassIds() {
		return classroom.myClassIds();
	}

	private boolean isTeacherOf(UUID schoolId, UUID classId) {
		return classId != null && classroom.isTeacherAt(schoolId) && classroom.myClassIds().contains(classId);
	}

	// ------------------------------------------------------------ chung

	public UUID requireSelectedSchool() {
		return classroom.requireSelectedSchool();
	}

	public UUID myUserId() {
		return scope().userId();
	}

	private static void requireSchool(UUID schoolId) {
		if (!scope().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập trường này.");
		}
	}

}
