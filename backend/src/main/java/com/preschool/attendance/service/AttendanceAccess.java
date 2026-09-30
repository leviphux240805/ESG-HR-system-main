package com.preschool.attendance.service;

import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module chấm công & nghỉ phép (ma trận thiết kế): chủ chuỗi, kế toán xem; văn phòng điều hành quản lý mọi cơ
 * sở; hiệu trưởng quản lý cơ sở mình (sửa bảng công, import, khóa, duyệt nghỉ); nhân viên chỉ xem bảng công của mình
 * (qua /me) và xin nghỉ.
 */
@Component
public class AttendanceAccess {

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	/** Xem bảng công, cấu hình của cơ sở. */
	public boolean canView(UUID schoolId) {
		return schoolId != null && (scope().hasRoleAt(RoleCode.OWNER, schoolId)
				|| scope().hasRoleAt(RoleCode.CHAIN_ADMIN, schoolId) || scope().hasRoleAt(RoleCode.ACCOUNTANT, schoolId)
				|| scope().hasRoleAt(RoleCode.PRINCIPAL, schoolId));
	}

	/** Sửa bảng công, import, khóa công, cấu hình, ngày lễ riêng, duyệt nghỉ của cơ sở. */
	public boolean canManage(UUID schoolId) {
		return schoolId != null && (scope().hasRoleAt(RoleCode.CHAIN_ADMIN, schoolId)
				|| scope().hasRoleAt(RoleCode.PRINCIPAL, schoolId));
	}

	/** Cấu hình mặc định, ngày lễ toàn chuỗi, mở khóa công: văn phòng điều hành. */
	public boolean isChainAdmin() {
		return scope().access().grants().stream().anyMatch(g -> g.schoolId() == null && g.role() == RoleCode.CHAIN_ADMIN);
	}

	/** Có vai trò xem được ở ít nhất một cơ sở trong phạm vi (ẩn/hiện danh sách chung như ngày lễ toàn chuỗi). */
	public boolean canViewAny() {
		return scope().effectiveSchoolIds().stream().anyMatch(this::canView);
	}

	public void requireView(UUID schoolId) {
		requireInScope(schoolId);
		if (!canView(schoolId)) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", "Bạn không có quyền xem chấm công của cơ sở này.");
		}
	}

	public void requireManage(UUID schoolId) {
		requireInScope(schoolId);
		if (!canManage(schoolId)) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", "Bạn không có quyền quản lý chấm công của cơ sở này.");
		}
	}

	public void requireChainAdmin(String message) {
		if (!isChainAdmin()) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", message);
		}
	}

	private static void requireInScope(UUID schoolId) {
		if (schoolId == null) {
			throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn một cơ sở.");
		}
		if (!scope().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
		}
	}

}
