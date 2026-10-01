package com.preschool.attendance.service;

import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module chấm công & nghỉ phép (ma trận thiết kế): hiệu trưởng và phó hiệu trưởng nhóm Nhân sự quản lý trường
 * được gán (sửa bảng công, import, khóa, duyệt nghỉ); kế toán xem; nhân viên chỉ xem bảng công của mình (qua /me) và
 * xin nghỉ. Cấu hình mặc định, ngày lễ chung của tổ chức và mở khóa công: hiệu trưởng.
 */
@Component
public class AttendanceAccess {

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	/** Xem bảng công, cấu hình của trường. */
	public boolean canView(UUID schoolId) {
		return schoolId != null && (canManage(schoolId) || scope().hasRoleAt(RoleCode.ACCOUNTANT, schoolId));
	}

	/** Sửa bảng công, import, khóa công, cấu hình, ngày lễ riêng, duyệt nghỉ của trường. */
	public boolean canManage(UUID schoolId) {
		return schoolId != null && scope().manages(schoolId, FunctionGroup.HR);
	}

	/** Cấu hình mặc định, ngày lễ chung của tổ chức, mở khóa công: hiệu trưởng. */
	public boolean isPrincipal() {
		return scope().isPrincipal();
	}

	/** Hiệu trưởng của đúng trường (mở khóa công tháng, duyệt đơn nghỉ của hiệu trưởng). */
	public boolean isPrincipalAt(UUID schoolId) {
		return scope().hasRoleAt(RoleCode.PRINCIPAL, schoolId);
	}

	/** Có vai trò xem được ở ít nhất một trường trong phạm vi (ẩn/hiện danh sách chung như ngày lễ chung). */
	public boolean canViewAny() {
		return scope().effectiveSchoolIds().stream().anyMatch(this::canView);
	}

	public void requireView(UUID schoolId) {
		requireInScope(schoolId);
		if (!canView(schoolId)) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", "Bạn không có quyền xem chấm công của trường này.");
		}
	}

	public void requireManage(UUID schoolId) {
		requireInScope(schoolId);
		if (!canManage(schoolId)) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", "Bạn không có quyền quản lý chấm công của trường này.");
		}
	}

	public void requirePrincipal(String message) {
		if (!isPrincipal()) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", message);
		}
	}

	private static void requireInScope(UUID schoolId) {
		if (schoolId == null) {
			throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn một trường.");
		}
		if (!scope().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập trường này.");
		}
	}

}
