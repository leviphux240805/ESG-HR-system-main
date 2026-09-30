package com.preschool.task.service;

import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module công việc (ma trận thiết kế): chủ chuỗi và văn phòng điều hành giao việc toàn chuỗi; hiệu trưởng
 * giao việc trong cơ sở mình; nhân viên khác chỉ thấy và cập nhật việc được giao cho mình.
 *
 * <p>Việc có {@code schoolId} rỗng là việc toàn chuỗi (văn phòng điều hành giao), chỉ vai trò cấp chuỗi quản lý.
 */
@Component
public class TaskAccess {

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	/** Giao việc, sửa, xóa: cấp chuỗi ở mọi cơ sở; hiệu trưởng ở cơ sở mình. */
	public boolean canManage(UUID schoolId) {
		if (isChainManager()) {
			return true;
		}
		return schoolId != null && scope().hasRoleAt(RoleCode.PRINCIPAL, schoolId);
	}

	/** Chủ chuỗi hoặc văn phòng điều hành (vai trò cấp chuỗi): quản lý cả việc toàn chuỗi. */
	public boolean isChainManager() {
		return scope().access()
			.grants()
			.stream()
			.anyMatch(g -> g.schoolId() == null && (g.role() == RoleCode.OWNER || g.role() == RoleCode.CHAIN_ADMIN));
	}

	/** Có quyền giao việc ở ít nhất một cơ sở (hiện/ẩn nút "Giao việc"). */
	public boolean canManageAny() {
		return isChainManager() || scope().effectiveSchoolIds().stream().anyMatch(this::canManage);
	}

	public void requireManage(UUID schoolId) {
		if (schoolId != null && !scope().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
		}
		if (!canManage(schoolId)) {
			throw ApiException.forbidden("TASK_FORBIDDEN", schoolId == null
					? "Chỉ văn phòng điều hành giao được việc toàn chuỗi." : "Bạn không có quyền giao việc ở cơ sở này.");
		}
	}

	/** Hồ sơ nhân viên gắn với tài khoản; rỗng nếu tài khoản chưa gắn hồ sơ. */
	public UUID myStaffId() {
		return scope().access().staffId();
	}

	public UUID myUserId() {
		return scope().userId();
	}

}
