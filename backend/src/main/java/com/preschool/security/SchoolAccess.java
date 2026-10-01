package com.preschool.security;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;

/**
 * Phạm vi truy cập của một người dùng, nạp từ {@code user_roles}.
 *
 * @param userId id người dùng
 * @param staffId hồ sơ nhân viên gắn với tài khoản (rỗng nếu không gắn)
 * @param organizationId tổ chức của người dùng (dữ liệu dùng chung lọc theo tổ chức này)
 * @param grants các vai trò, mỗi vai trò gắn một trường
 * @param schoolIds các trường (đang hoạt động) được phép truy cập
 * @param mustChangePassword đang dùng mật khẩu do người khác đặt: chỉ được đổi mật khẩu
 */
public record SchoolAccess(UUID userId, UUID staffId, UUID organizationId, List<Grant> grants, Set<UUID> schoolIds,
		boolean mustChangePassword) {

	/** Vai trò ở một trường; {@code groups} chỉ có ở phó hiệu trưởng. */
	public record Grant(RoleCode role, UUID schoolId, Set<FunctionGroup> groups) {

		public Grant(RoleCode role, UUID schoolId) {
			this(role, schoolId, Set.of());
		}

	}

	public boolean canAccess(UUID schoolId) {
		return schoolIds.contains(schoolId);
	}

	/** Có vai trò {@code role} ở trường {@code schoolId}. */
	public boolean hasRole(RoleCode role, UUID schoolId) {
		return grants.stream().anyMatch(g -> g.role() == role && g.schoolId().equals(schoolId));
	}

	/** Có vai trò {@code role} ở ít nhất một trường đang hoạt động. */
	public boolean hasRoleAnywhere(RoleCode role) {
		return grants.stream().anyMatch(g -> g.role() == role && schoolIds.contains(g.schoolId()));
	}

	/** Hiệu trưởng của trường, hoặc phó hiệu trưởng được giao nhóm {@code group} ở trường đó. */
	public boolean manages(UUID schoolId, FunctionGroup group) {
		return grants.stream()
			.anyMatch(g -> g.schoolId().equals(schoolId) && (g.role() == RoleCode.PRINCIPAL
					|| (g.role() == RoleCode.VICE_PRINCIPAL && g.groups().contains(group))));
	}

}
