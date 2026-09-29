package com.preschool.security;

import java.util.Arrays;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;

import org.springframework.stereotype.Component;

/**
 * Hàm kiểm tra quyền cho {@code @PreAuthorize}, luôn xét theo cơ sở đang chọn. Ví dụ:
 *
 * <pre>
 * &#64;PreAuthorize("@perm.hasAnyRole('OWNER', 'CHAIN_ADMIN', 'PRINCIPAL')")
 * &#64;PreAuthorize("@perm.hasRoleAt('PRINCIPAL', #schoolId)")
 * </pre>
 *
 * Quyền chi tiết theo dữ liệu (lớp được phân công, hồ sơ của mình) viết thêm hàm ở đây khi làm module tương ứng.
 */
@Component("perm")
public class Perm {

	/** Có vai trò áp dụng cho ít nhất một cơ sở trong phạm vi đang chọn. */
	public boolean hasRole(String role) {
		return SchoolScope.current().map(s -> s.hasRole(RoleCode.valueOf(role))).orElse(false);
	}

	public boolean hasAnyRole(String... roles) {
		return Arrays.stream(roles).anyMatch(this::hasRole);
	}

	/** Có vai trò áp dụng cho đúng cơ sở {@code schoolId}, và cơ sở đó nằm trong phạm vi đang chọn. */
	public boolean hasRoleAt(String role, UUID schoolId) {
		return SchoolScope.current().map(s -> s.hasRoleAt(RoleCode.valueOf(role), schoolId)).orElse(false);
	}

	public boolean canAccessSchool(UUID schoolId) {
		return SchoolScope.current().map(s -> s.canAccessSchool(schoolId)).orElse(false);
	}

	/** Có vai trò cấp chuỗi (được xem "Tất cả cơ sở"). */
	public boolean isChainWide() {
		return SchoolScope.current().map(s -> s.access().chainWide()).orElse(false);
	}

}
