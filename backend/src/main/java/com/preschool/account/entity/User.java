package com.preschool.account.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
@Filter(name = OrganizationFilter.NAME)
public class User extends OrganizationEntity {

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

	@Column(name = "must_change_password", nullable = false)
	private boolean mustChangePassword;

	@Column(name = "last_login_at")
	private Instant lastLoginAt;

	@OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<UserRole> roles = new ArrayList<>();

	protected User() {
	}

	public User(String email, String phone, String fullName, String passwordHash) {
		this(null, email, phone, fullName, passwordHash);
	}

	/** Tạo ngoài request (seed, test, bên vận hành): gán tổ chức trực tiếp. */
	public User(java.util.UUID organizationId, String email, String phone, String fullName, String passwordHash) {
		assignOrganization(organizationId);
		this.email = email;
		this.phone = phone;
		this.fullName = fullName;
		this.passwordHash = passwordHash;
	}

	public UserRole addRole(RoleCode roleCode, UUID schoolId) {
		return addRole(new RoleAssignment(roleCode, schoolId));
	}

	public UserRole addRole(RoleAssignment assignment) {
		UserRole role = new UserRole(this, assignment);
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

	public void linkStaff(UUID staffId) {
		this.staffId = staffId;
	}

	/** Người dùng tự đổi (hoặc qua link đặt lại): không còn bắt đổi mật khẩu. */
	public void changePassword(String newPasswordHash) {
		this.passwordHash = newPasswordHash;
		this.mustChangePassword = false;
	}

	/** Mật khẩu do người khác đặt (tạo tài khoản, hiệu trưởng đặt lại): bắt đổi ở lần đăng nhập kế tiếp. */
	public void assignPassword(String newPasswordHash) {
		this.passwordHash = newPasswordHash;
		this.mustChangePassword = true;
	}

	public boolean isMustChangePassword() {
		return mustChangePassword;
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

	/**
	 * Thay bộ vai trò: xóa vai trò bị bỏ, cập nhật nhóm chức năng của vai trò giữ lại, thêm vai trò mới (giữ nguyên
	 * dòng không đổi, tránh trùng khóa khi flush).
	 */
	public void replaceRoles(java.util.Collection<RoleAssignment> wanted) {
		roles.removeIf(r -> wanted.stream().noneMatch(w -> w.role() == r.getRoleCode() && w.schoolId().equals(r.getSchoolId())));
		for (RoleAssignment w : wanted) {
			roles.stream()
				.filter(r -> r.getRoleCode() == w.role() && r.getSchoolId().equals(w.schoolId()))
				.findFirst()
				.ifPresentOrElse(r -> r.setGroups(w.groups()), () -> addRole(w));
		}
	}

	public List<UserRole> getRoles() {
		return roles;
	}

}
