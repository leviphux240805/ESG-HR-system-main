package com.preschool.document.service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.document.entity.LibraryDocument;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Component;

/**
 * Quyền trên thư viện văn bản. Ban hành (thêm/sửa văn bản, thư mục): chủ chuỗi/văn phòng điều hành cho toàn chuỗi và
 * mọi cơ sở; hiệu trưởng, kế toán trong cơ sở của mình. Xem: văn bản thuộc phạm vi cơ sở đang chọn (Hibernate filter)
 * và vai trò của văn bản (rỗng = mọi vai trò); người ban hành luôn xem được văn bản mình quản lý.
 */
@Component
public class LibraryAccess {

	private static final List<RoleCode> CHAIN_PUBLISHERS = List.of(RoleCode.OWNER, RoleCode.CHAIN_ADMIN);

	private static final List<RoleCode> SCHOOL_PUBLISHERS = List.of(RoleCode.OWNER, RoleCode.CHAIN_ADMIN,
			RoleCode.PRINCIPAL, RoleCode.ACCOUNTANT);

	/** Ban hành/quản lý ở phạm vi {@code schoolId} (rỗng = toàn chuỗi). */
	public boolean canPublish(UUID schoolId) {
		SchoolScope scope = SchoolScope.require();
		if (schoolId == null) {
			return scope.access().grants().stream()
				.anyMatch(g -> g.schoolId() == null && CHAIN_PUBLISHERS.contains(g.role()));
		}
		return SCHOOL_PUBLISHERS.stream().anyMatch(role -> scope.hasRoleAt(role, schoolId));
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
					? "Chỉ chủ chuỗi hoặc văn phòng điều hành được ban hành văn bản toàn chuỗi."
					: "Bạn không có quyền ban hành văn bản cho cơ sở này.");
		}
	}

	public void requireManage(LibraryDocument document) {
		if (!canManage(document)) {
			throw ApiException.forbidden("LIBRARY_FORBIDDEN", "Bạn không có quyền quản lý văn bản này.");
		}
	}

}
