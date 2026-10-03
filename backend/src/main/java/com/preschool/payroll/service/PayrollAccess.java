package com.preschool.payroll.service;

import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền bảng lương: hiệu trưởng, phó hiệu trưởng nhóm Tài chính và kế toán xem, tính, sửa thưởng/phạt, đánh dấu đã
 * trả; chỉ hiệu trưởng duyệt và mở lại. Nhân viên chỉ xem phiếu lương của mình khi bảng đã duyệt.
 */
@Component
public class PayrollAccess {

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	public boolean canEdit(UUID schoolId) {
		return scope().hasRoleAt(RoleCode.ACCOUNTANT, schoolId) || scope().manages(schoolId, FunctionGroup.FINANCE);
	}

	public boolean canApprove(UUID schoolId) {
		return scope().hasRoleAt(RoleCode.PRINCIPAL, schoolId);
	}

	public void requireEdit(UUID schoolId) {
		if (!canEdit(schoolId)) {
			throw ApiException.forbidden("PAYROLL_FORBIDDEN", "Bạn không có quyền xem bảng lương của trường này.");
		}
	}

	public void requireApprove(UUID schoolId) {
		if (!canApprove(schoolId)) {
			throw ApiException.forbidden("PAYROLL_APPROVE_FORBIDDEN", "Chỉ hiệu trưởng được duyệt hoặc mở lại bảng lương.");
		}
	}

	/** Bảng lương xem theo từng trường: trường đang chọn, hoặc trường duy nhất của người dùng. */
	public UUID requireSelectedSchool() {
		UUID id = scope().selectedSchoolId();
		if (id == null && scope().effectiveSchoolIds().size() == 1) {
			id = scope().effectiveSchoolIds().iterator().next();
		}
		if (id == null) {
			throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn một trường để xem bảng lương.");
		}
		return id;
	}

}
