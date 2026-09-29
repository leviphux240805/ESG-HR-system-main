package com.preschool.security;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;

/**
 * Phạm vi truy cập của một người dùng, nạp từ {@code user_roles}.
 *
 * @param userId id người dùng
 * @param grants các vai trò kèm phạm vi ({@code schoolId} rỗng = toàn chuỗi)
 * @param chainWide có ít nhất một vai trò cấp chuỗi, nên được chọn "Tất cả cơ sở"
 * @param schoolIds các cơ sở (đang hoạt động) được phép truy cập
 */
public record SchoolAccess(UUID userId, List<Grant> grants, boolean chainWide, Set<UUID> schoolIds) {

	public record Grant(RoleCode role, UUID schoolId) {
	}

	public boolean canAccess(UUID schoolId) {
		return schoolIds.contains(schoolId);
	}

	/** Có vai trò {@code role} áp dụng cho cơ sở {@code schoolId} (vai trò cấp chuỗi áp dụng mọi cơ sở). */
	public boolean hasRole(RoleCode role, UUID schoolId) {
		return grants.stream()
			.anyMatch(g -> g.role() == role && (g.schoolId() == null || g.schoolId().equals(schoolId)));
	}

	public boolean hasRoleAnywhere(RoleCode role) {
		return grants.stream().anyMatch(g -> g.role() == role);
	}

}
