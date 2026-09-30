package com.preschool.staff.service;

import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffDtos.StaffPermissions;
import com.preschool.staff.entity.Staff;

import org.springframework.stereotype.Component;

/**
 * Quy tắc quyền của module nhân sự (docs/thiet-ke.md: ma trận quyền + quyết định chi tiết giai đoạn 2).
 * Hồ sơ ngoài phạm vi cơ sở đã bị Hibernate filter loại (404); ở đây kiểm tra quyền theo vai trò trên hồ sơ cụ thể.
 */
@Component("staffAccess")
public class StaffAccess {

	/** Xem danh sách nhân sự: cấp chuỗi, kế toán, hiệu trưởng (theo cơ sở đang chọn). */
	public boolean canList() {
		return scope().hasRole(RoleCode.OWNER) || scope().hasRole(RoleCode.CHAIN_ADMIN)
				|| scope().hasRole(RoleCode.ACCOUNTANT) || scope().hasRole(RoleCode.PRINCIPAL);
	}

	public boolean isSelf(Staff staff) {
		return staff.getId().equals(scope().access().staffId());
	}

	public boolean canView(Staff staff) {
		return isSelf(staff) || hasAt(staff, RoleCode.OWNER, RoleCode.CHAIN_ADMIN, RoleCode.ACCOUNTANT,
				RoleCode.PRINCIPAL);
	}

	/** Sửa hồ sơ, hợp đồng, giấy tờ, chứng chỉ: cấp chuỗi hoặc hiệu trưởng của đúng cơ sở. */
	public boolean canEdit(Staff staff) {
		return hasAt(staff, RoleCode.OWNER, RoleCode.CHAIN_ADMIN, RoleCode.PRINCIPAL);
	}

	/** Xem lương và ngân hàng: cấp chuỗi, kế toán, chính chủ. Hiệu trưởng không xem. */
	public boolean canViewSalary(Staff staff) {
		return isSelf(staff) || hasAt(staff, RoleCode.OWNER, RoleCode.CHAIN_ADMIN, RoleCode.ACCOUNTANT);
	}

	/** Điều chỉnh lương, ngân hàng, điều chuyển, tạo tài khoản: chỉ cấp chuỗi. */
	public boolean canManageSalary(Staff staff) {
		return hasAt(staff, RoleCode.OWNER, RoleCode.CHAIN_ADMIN);
	}

	public boolean canTransfer(Staff staff) {
		return canManageSalary(staff);
	}

	/** Cho nghỉ việc: cấp chuỗi hoặc hiệu trưởng của đúng cơ sở (chủ dự án chốt 2026-09-30). */
	public boolean canTerminate(Staff staff) {
		return hasAt(staff, RoleCode.OWNER, RoleCode.CHAIN_ADMIN, RoleCode.PRINCIPAL);
	}

	/** Tạo tài khoản đăng nhập kèm hồ sơ: chỉ cấp chuỗi. */
	public boolean canCreateAccounts() {
		return scope().access().grants().stream()
			.anyMatch(g -> g.schoolId() == null && (g.role() == RoleCode.OWNER || g.role() == RoleCode.CHAIN_ADMIN));
	}

	/** Thêm nhân viên vào cơ sở: cấp chuỗi hoặc hiệu trưởng của cơ sở đó. */
	public boolean canCreateIn(java.util.UUID schoolId) {
		return scope().canAccessSchool(schoolId) && (scope().hasRoleAt(RoleCode.OWNER, schoolId)
				|| scope().hasRoleAt(RoleCode.CHAIN_ADMIN, schoolId) || scope().hasRoleAt(RoleCode.PRINCIPAL, schoolId));
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
			throw ApiException.forbidden("SALARY_FORBIDDEN", "Chỉ văn phòng điều hành hoặc chủ chuỗi được thực hiện thao tác này.");
		}
	}

	private boolean hasAt(Staff staff, RoleCode... roles) {
		for (RoleCode role : roles) {
			if (scope().hasRoleAt(role, staff.getSchoolId())) {
				return true;
			}
		}
		return false;
	}

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

}
