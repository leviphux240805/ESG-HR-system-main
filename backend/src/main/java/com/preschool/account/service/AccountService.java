package com.preschool.account.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Tạo và cấu hình tài khoản đăng nhập (do văn phòng điều hành/chủ chuỗi thực hiện). */
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

	public record Grant(RoleCode role, UUID schoolId) {
	}

	/**
	 * Tạo tài khoản với mật khẩu ngẫu nhiên không ai biết, gắn hồ sơ nhân viên (nếu có), gán vai trò và gửi email
	 * mời tự đặt mật khẩu.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public User create(String email, String phone, String fullName, UUID staffId, List<Grant> grants) {
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
		grants.forEach(g -> user.addRole(g.role(), g.schoolId()));
		users.save(user);
		passwordResetService.sendInvite(user);
		return user;
	}

	/** Phạm vi vai trò đúng thiết kế và cơ sở nằm trong phạm vi của người gán. */
	public void validateGrants(List<Grant> grants) {
		if (grants.isEmpty()) {
			throw ApiException.badRequest("ROLE_REQUIRED", "Cần gán ít nhất một vai trò.");
		}
		SchoolScope scope = SchoolScope.require();
		for (Grant grant : grants) {
			boolean ok = switch (grant.role().scope()) {
				case CHAIN -> grant.schoolId() == null;
				case SCHOOL -> grant.schoolId() != null;
				case CHAIN_OR_SCHOOL -> true;
			};
			if (!ok) {
				throw ApiException.badRequest("ROLE_SCOPE_INVALID", grant.role().scope() == RoleCode.Scope.CHAIN
						? "Vai trò này chỉ gán cho toàn chuỗi."
						: "Vai trò này phải gắn với một cơ sở.");
			}
			if (grant.schoolId() != null && !scope.access().canAccess(grant.schoolId())) {
				throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền gán vai trò ở cơ sở này.");
			}
		}
	}

}
