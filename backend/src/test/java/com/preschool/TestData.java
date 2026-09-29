package com.preschool;

import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tạo dữ liệu riêng cho từng test (mã/email ngẫu nhiên) để các test không đụng nhau. */
@Component
public class TestData {

	public static final String PASSWORD = "Matkhau@123";

	private final SchoolRepository schools;

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	public TestData(SchoolRepository schools, UserRepository users, PasswordEncoder passwordEncoder) {
		this.schools = schools;
		this.users = users;
		this.passwordEncoder = passwordEncoder;
	}

	public School school() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		return schools.save(new School("T-" + suffix, "Cơ sở thử " + suffix));
	}

	/** Tạo tài khoản với một vai trò; {@code school} rỗng = vai trò toàn chuỗi. */
	@Transactional
	public User user(RoleCode role, School school) {
		return user(role, school, null);
	}

	@Transactional
	public User user(RoleCode role, School school, String phone) {
		String email = role.name().toLowerCase() + "." + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
		User user = new User(email, phone, "Người thử " + role.name(), passwordEncoder.encode(PASSWORD));
		user.addRole(role, school == null ? null : school.getId());
		return users.save(user);
	}

	@Transactional
	public void deactivate(User user) {
		User managed = users.findById(user.getId()).orElseThrow();
		managed.setActive(false);
	}

}
