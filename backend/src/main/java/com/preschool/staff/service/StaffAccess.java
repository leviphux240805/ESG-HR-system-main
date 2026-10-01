package com.preschool.staff.service;

import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffDtos.StaffPermissions;
import com.preschool.staff.entity.Staff;

import org.springframework.stereotype.Component;

/**
 * Quy tắc quyền của module nhân sự (docs/thiet-ke.md: ma trận quyền + quyết định chi tiết giai đoạn 2). Hiệu trưởng
 * toàn quyền ở trường được gán (cả lương, điều chuyển, tạo tài khoản); phó hiệu trưởng nhóm Nhân sự sửa hồ sơ, cho
 * nghỉ việc; nhóm Tài chính xem và sửa lương; kế toán xem hồ sơ, lương. Hồ sơ ngoài phạm vi đã bị Hibernate filter
 * loại (404); ở đây kiểm tra quyền theo vai trò trên hồ sơ cụ thể.
 */
@Component("staffAccess")
public class StaffAccess {

	/** Xem danh sách nhân sự của trường đang chọn. */
	public boolean canList() {
		return scope().hasRole(RoleCode.ACCOUNTANT) || scope().managesAny(FunctionGroup.HR)
				|| scope().managesAny(FunctionGroup.FINANCE);
	}

	public boolean isSelf(Staff staff) {
		return staff.getId().equals(scope().access().staffId());
	}

	public boolean canView(Staff staff) {
		return isSelf(staff) || canViewSalary(staff) || canEdit(staff);
	}

	/** Sửa hồ sơ, hợp đồng, giấy tờ, chứng chỉ. */
	public boolean canEdit(Staff staff) {
		return scope().manages(staff.getSchoolId(), FunctionGroup.HR);
	}

	/** Xem lương và ngân hàng: chính chủ, kế toán, hiệu trưởng, phó hiệu trưởng nhóm Tài chính. */
	public boolean canViewSalary(Staff staff) {
		return isSelf(staff) || scope().hasRoleAt(RoleCode.ACCOUNTANT, staff.getSchoolId()) || canManageSalary(staff);
	}

	/** Điều chỉnh lương, ngân hàng. */
	public boolean canManageSalary(Staff staff) {
		return scope().manages(staff.getSchoolId(), FunctionGroup.FINANCE);
	}

	/** Điều chuyển sang trường khác: hiệu trưởng của trường hiện tại (trường đích kiểm tra khi điều chuyển). */
	public boolean canTransfer(Staff staff) {
		return scope().hasRoleAt(RoleCode.PRINCIPAL, staff.getSchoolId());
	}

	/** Cho nghỉ việc. */
	public boolean canTerminate(Staff staff) {
		return canEdit(staff);
	}

	/** Tạo tài khoản đăng nhập kèm hồ sơ: hiệu trưởng. */
	public boolean canCreateAccounts() {
		return scope().isPrincipal();
	}

	/** Thêm nhân viên vào trường. */
	public boolean canCreateIn(UUID schoolId) {
		return scope().manages(schoolId, FunctionGroup.HR);
	}

	/** Trường đích của điều chuyển: hiệu trưởng cũng phải quản lý trường đó. */
	public boolean canReceiveTransfer(UUID schoolId) {
		return SchoolScope.require().access().hasRole(RoleCode.PRINCIPAL, schoolId)
				&& SchoolScope.require().access().canAccess(schoolId);
	}

	public StaffPermissions permissionsOn(Staff staff) {
		return new StaffPermissions(canEdit(staff), canViewSalary(staff), canManageSalary(staff), canTransfer(staff),
				canTerminate(staff), isSelf(staff));
	}

	// ---- ném lỗi 403 tiếng Việt

	public void requireView(Staff staff) {
		if (!canView(staff)) {
			throw ApiException.forbidden("STAFF_FORBIDDEN", "Bạn không có quyền xem hồ sơ nhân viên này.");
		}
	}

	public void requireEdit(Staff staff) {
		if (!canEdit(staff)) {
			throw ApiException.forbidden("STAFF_FORBIDDEN", "Bạn không có quyền sửa hồ sơ nhân viên này.");
		}
	}

	public void requireViewSalary(Staff staff) {
		if (!canViewSalary(staff)) {
			throw ApiException.forbidden("SALARY_FORBIDDEN", "Bạn không có quyền xem thông tin lương của nhân viên này.");
		}
	}

	public void requireManageSalary(Staff staff) {
		if (!canManageSalary(staff)) {
			throw ApiException.forbidden("SALARY_FORBIDDEN", "Bạn không có quyền sửa lương của nhân viên này.");
		}
	}

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

}
