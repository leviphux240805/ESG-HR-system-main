package com.preschool.task.service;

import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền module công việc (ma trận thiết kế): hiệu trưởng và phó hiệu trưởng nhóm Nhân sự giao việc trong trường được
 * gán; nhân viên khác chỉ thấy và cập nhật việc được giao cho mình.
 *
 * <p>Việc có {@code schoolId} rỗng là việc chung của tổ chức, chỉ hiệu trưởng quản lý.
 */
@Component
public class TaskAccess {

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	/** Giao việc, sửa, xóa: việc chung của tổ chức → hiệu trưởng; việc của trường → ban giám hiệu nhóm Nhân sự. */
	public boolean canManage(UUID schoolId) {
		return schoolId == null ? isPrincipal() : scope().manages(schoolId, FunctionGroup.HR);
	}

	/** Hiệu trưởng: quản lý cả việc chung của tổ chức. */
	public boolean isPrincipal() {
		return scope().isPrincipal();
	}

	/** Có quyền giao việc ở ít nhất một trường (hiện/ẩn nút "Giao việc"). */
	public boolean canManageAny() {
		return isPrincipal() || scope().managesAny(FunctionGroup.HR);
	}

	public void requireManage(UUID schoolId) {
		if (schoolId != null && !scope().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập trường này.");
		}
		if (!canManage(schoolId)) {
			throw ApiException.forbidden("TASK_FORBIDDEN", schoolId == null
					? "Chỉ hiệu trưởng giao được việc chung của tổ chức." : "Bạn không có quyền giao việc ở trường này.");
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
