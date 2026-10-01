package com.preschool.account.entity;

import java.util.Set;
import java.util.UUID;

/** Một vai trò ở một trường; {@code groups} chỉ dùng cho phó hiệu trưởng (vai trò khác luôn rỗng). */
public record RoleAssignment(RoleCode role, UUID schoolId, Set<FunctionGroup> groups) {

	public RoleAssignment {
		groups = role == RoleCode.VICE_PRINCIPAL && groups != null ? Set.copyOf(groups) : Set.of();
	}

	public RoleAssignment(RoleCode role, UUID schoolId) {
		this(role, schoolId, Set.of());
	}

}
