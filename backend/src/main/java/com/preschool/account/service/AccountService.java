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

	public AccountService(UserRepository users, PasswordEncoder passwordEncoder) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
	}

	/**
	 * Tạo tài khoản đăng nhập bằng email hoặc số điện thoại, mật khẩu do người tạo đặt (người dùng phải đổi ở lần
	 * đăng nhập đầu), gắn hồ sơ nhân viên (nếu có) và gán vai trò.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public User create(String email, String phone, String fullName, UUID staffId, List<RoleAssignment> grants,
			String password) {
		if (email == null && phone == null) {
			throw ApiException.badRequest("ACCOUNT_LOGIN_REQUIRED", "Cần email hoặc số điện thoại để đăng nhập.");
		}
		List<Map<String, String>> conflicts = new ArrayList<>();
		if (email != null && users.existsByEmail(email)) {
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
		PasswordResetService.validatePassword(password);

		User user = new User(email, phone, fullName, null);
		user.assignPassword(passwordEncoder.encode(password));
		user.linkStaff(staffId);
		grants.forEach(user::addRole);
		users.save(user);
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
