package com.preschool.finance.service;

import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module Học phí & thu chi (ma trận thiết kế): kế toán, hiệu trưởng và phó hiệu trưởng nhóm Tài chính làm việc
 * ở trường được gán. Danh mục khoản thu và cấu hình chung của tổ chức do hiệu trưởng sửa.
 */
@Component
public class FinanceAccess {

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	public boolean canView(UUID schoolId) {
		return canManage(schoolId);
	}

	public boolean canManage(UUID schoolId) {
		return scope().hasRoleAt(RoleCode.ACCOUNTANT, schoolId) || scope().manages(schoolId, FunctionGroup.FINANCE);
	}

	/** Ghi nhận thanh toán. */
	public boolean canCollect(UUID schoolId) {
		return canManage(schoolId);
	}

	public boolean canManageCatalog() {
		return scope().isPrincipal();
	}

	public void requireViewAny() {
		if (scope().effectiveSchoolIds().stream().noneMatch(this::canView)) {
			throw ApiException.forbidden("FINANCE_FORBIDDEN", "Bạn không có quyền xem học phí, thu chi.");
		}
	}

	public void requireView(UUID schoolId) {
		requireSchool(schoolId);
		if (!canView(schoolId)) {
			throw ApiException.forbidden("FINANCE_FORBIDDEN", "Bạn không có quyền xem học phí, thu chi ở trường này.");
		}
	}

	public void requireManage(UUID schoolId) {
		requireSchool(schoolId);
		if (!canManage(schoolId)) {
			throw ApiException.forbidden("FINANCE_FORBIDDEN", "Bạn không có quyền quản lý học phí, thu chi ở trường này.");
		}
	}

	public void requireCollect(UUID schoolId) {
		requireSchool(schoolId);
		if (!canCollect(schoolId)) {
			throw ApiException.forbidden("FINANCE_FORBIDDEN", "Bạn không có quyền ghi nhận thanh toán ở trường này.");
		}
	}

	public void requireManageCatalog() {
		if (!canManageCatalog()) {
			throw ApiException.forbidden("FINANCE_FORBIDDEN", "Chỉ hiệu trưởng sửa được danh mục chung.");
		}
	}

	public UUID requireSelectedSchool() {
		UUID id = scope().selectedSchoolId();
		if (id == null) {
			throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn một trường.");
		}
		return id;
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
