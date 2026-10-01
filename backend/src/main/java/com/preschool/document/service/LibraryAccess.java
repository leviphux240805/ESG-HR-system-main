package com.preschool.document.service;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.document.entity.LibraryDocument;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền trên thư viện văn bản. Ban hành (thêm/sửa văn bản, thư mục): hiệu trưởng cho cả tổ chức và trường được gán;
 * phó hiệu trưởng nhóm Nhân sự, kế toán trong trường của mình. Xem: văn bản thuộc phạm vi cơ sở đang chọn (Hibernate filter)
 * và vai trò của văn bản (rỗng = mọi vai trò); người ban hành luôn xem được văn bản mình quản lý.
 */
@Component
public class LibraryAccess {

	/** Ban hành/quản lý ở phạm vi {@code schoolId} (rỗng = cả tổ chức). */
	public boolean canPublish(UUID schoolId) {
		SchoolScope scope = SchoolScope.require();
		if (schoolId == null) {
			return scope.isPrincipal();
		}
		return scope.manages(schoolId, FunctionGroup.HR) || scope.hasRoleAt(RoleCode.ACCOUNTANT, schoolId);
	}

	/** Cơ sở trong phạm vi đang chọn mà người dùng được ban hành. */
	public Set<UUID> publisherSchools() {
		return SchoolScope.require().effectiveSchoolIds().stream().filter(this::canPublish)
			.collect(Collectors.toSet());
	}

	public boolean canManage(LibraryDocument document) {
		return canPublish(document.getSchoolId());
	}

	/** Văn bản đã qua filter cơ sở; kiểm thêm vai trò được xem. */
	public boolean canView(LibraryDocument document) {
		if (canManage(document) || document.getVisibleRoles().isEmpty()) {
			return true;
		}
		SchoolScope scope = SchoolScope.require();
		return document.getVisibleRoles().stream()
			.anyMatch(role -> document.getSchoolId() == null ? scope.hasRole(role)
					: scope.hasRoleAt(role, document.getSchoolId()));
	}

	public void requirePublish(UUID schoolId) {
		if (!canPublish(schoolId)) {
			throw ApiException.forbidden("LIBRARY_FORBIDDEN", schoolId == null
					? "Chỉ hiệu trưởng được ban hành văn bản chung của tổ chức."
					: "Bạn không có quyền ban hành văn bản cho trường này.");
		}
	}

	public void requireManage(LibraryDocument document) {
		if (!canManage(document)) {
			throw ApiException.forbidden("LIBRARY_FORBIDDEN", "Bạn không có quyền quản lý văn bản này.");
		}
	}

}
