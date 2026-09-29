package com.preschool.account.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

	@Column(nullable = false)
	private String email;

	private String phone;

	@Column(name = "full_name", nullable = false)
	private String fullName;

	@Column(name = "password_hash", nullable = false)
	private String passwordHash;

	@Column(name = "staff_id")
	private UUID staffId;

	@Column(name = "guardian_id")
	private UUID guardianId;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	@Column(name = "last_login_at")
	private Instant lastLoginAt;

	@OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<UserRole> roles = new ArrayList<>();

	protected User() {
	}

	public User(String email, String phone, String fullName, String passwordHash) {
		this.email = email;
		this.phone = phone;
		this.fullName = fullName;
		this.passwordHash = passwordHash;
	}

	public UserRole addRole(RoleCode roleCode, UUID schoolId) {
		UserRole role = new UserRole(this, roleCode, schoolId);
		roles.add(role);
		return role;
	}

	public String getEmail() {
		return email;
	}

	public String getPhone() {
		return phone;
	}

	public String getFullName() {
		return fullName;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public UUID getGuardianId() {
		return guardianId;
	}

	public void changePassword(String newPasswordHash) {
		this.passwordHash = newPasswordHash;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public Instant getLastLoginAt() {
		return lastLoginAt;
	}

	public void setLastLoginAt(Instant lastLoginAt) {
		this.lastLoginAt = lastLoginAt;
	}

	public List<UserRole> getRoles() {
		return roles;
	}

}
