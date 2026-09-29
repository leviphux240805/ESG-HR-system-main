package com.preschool.account.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Một vai trò của người dùng kèm phạm vi: {@code schoolId} rỗng = toàn chuỗi. */
@Entity
@Table(name = "user_roles")
public class UserRole extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(name = "role_code", nullable = false)
	private RoleCode roleCode;

	@Column(name = "school_id")
	private UUID schoolId;

	protected UserRole() {
	}

	UserRole(User user, RoleCode roleCode, UUID schoolId) {
		this.user = user;
		this.roleCode = roleCode;
		this.schoolId = schoolId;
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

	public boolean isChainWide() {
		return schoolId == null;
	}

}
