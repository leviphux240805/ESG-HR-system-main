package com.preschool.account.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.account.entity.RoleAssignment;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Tạo và cấu hình tài khoản đăng nhập (do hiệu trưởng thực hiện). */
@Service
public class AccountService {

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final PasswordResetService passwordResetService;

	public AccountService(UserRepository users, PasswordEncoder passwordEncoder,
			PasswordResetService passwordResetService) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.passwordResetService = passwordResetService;
	}

	/**
	 * Tạo tài khoản với mật khẩu ngẫu nhiên không ai biết, gắn hồ sơ nhân viên (nếu có), gán vai trò và gửi email
	 * mời tự đặt mật khẩu.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public User create(String email, String phone, String fullName, UUID staffId, List<RoleAssignment> grants) {
		if (email == null || email.isBlank()) {
			throw ApiException.badRequest("ACCOUNT_EMAIL_REQUIRED", "Cần email để tạo tài khoản đăng nhập.");
		}
		List<Map<String, String>> conflicts = new ArrayList<>();
		if (users.existsByEmail(email)) {
			conflicts.add(Map.of("field", "email", "message", "email đã được dùng cho một tài khoản khác"));
		}
		if (phone != null && users.existsByPhone(phone)) {
			conflicts.add(Map.of("field", "phone", "message", "số điện thoại đã được dùng cho một tài khoản khác"));
		}
		if (!conflicts.isEmpty()) {
			throw ApiException.conflict("ACCOUNT_DUPLICATE", "Thông tin đăng nhập đã được dùng cho tài khoản khác.")
				.withFieldErrors(conflicts);
		}
		validateGrants(grants);

		User user = new User(email, phone, fullName, passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
		user.linkStaff(staffId);
		grants.forEach(user::addRole);
		users.save(user);
		passwordResetService.sendInvite(user);
		return user;
	}

	/**
	 * Vai trò gán được: mọi vai trò trừ hiệu trưởng (bên vận hành gán), ở trường người gán làm hiệu trưởng; phó hiệu
	 * trưởng cần ít nhất một nhóm chức năng.
	 */
	public void validateGrants(List<RoleAssignment> grants) {
		if (grants.isEmpty()) {
			throw ApiException.badRequest("ROLE_REQUIRED", "Cần gán ít nhất một vai trò.");
		}
		SchoolScope scope = SchoolScope.require();
		for (RoleAssignment grant : grants) {
			if (grant.role() == RoleCode.PRINCIPAL) {
				throw ApiException.forbidden("PRINCIPAL_ROLE_FORBIDDEN",
						"Vai trò hiệu trưởng do bên vận hành gán, hoặc tự có khi tạo trường mới.");
			}
			if (!isPrincipalAt(scope, grant.schoolId())) {
				throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn chỉ gán được vai trò ở trường mình làm hiệu trưởng.");
			}
			if (grant.role() == RoleCode.VICE_PRINCIPAL && grant.groups().isEmpty()) {
				throw ApiException.badRequest("FUNCTION_GROUP_REQUIRED", "Phó hiệu trưởng cần ít nhất một nhóm chức năng.");
			}
		}
	}

	static boolean isPrincipalAt(SchoolScope scope, UUID schoolId) {
		return schoolId != null && scope.access().canAccess(schoolId)
				&& scope.access().hasRole(RoleCode.PRINCIPAL, schoolId);
	}

}
