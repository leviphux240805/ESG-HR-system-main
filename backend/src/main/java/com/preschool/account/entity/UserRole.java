package com.preschool.account.entity;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Một vai trò của người dùng ở một trường; phó hiệu trưởng có thêm nhóm chức năng được giao. */
@Entity
@Table(name = "user_roles")
public class UserRole extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(name = "role_code", nullable = false)
	private RoleCode roleCode;

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "function_groups", columnDefinition = "varchar(20)[]")
	private String[] functionGroups;

	protected UserRole() {
	}

	UserRole(User user, RoleAssignment assignment) {
		this.user = user;
		this.roleCode = assignment.role();
		this.schoolId = assignment.schoolId();
		setGroups(assignment.groups());
	}

	void setGroups(Set<FunctionGroup> groups) {
		this.functionGroups = roleCode == RoleCode.VICE_PRINCIPAL
				? groups.stream().map(Enum::name).sorted().toArray(String[]::new) : null;
	}

	public User getUser() {
		return user;
	}

	public RoleCode getRoleCode() {
		return roleCode;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public Set<FunctionGroup> getFunctionGroups() {
		if (functionGroups == null || functionGroups.length == 0) {
			return Set.of();
		}
		return EnumSet.copyOf(Arrays.stream(functionGroups).map(FunctionGroup::valueOf).toList());
	}

	public RoleAssignment toAssignment() {
		return new RoleAssignment(roleCode, schoolId, getFunctionGroups());
	}

}
