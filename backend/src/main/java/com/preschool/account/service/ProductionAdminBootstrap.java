package com.preschool.account.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("prod")
public class ProductionAdminBootstrap implements ApplicationRunner {

	private static final UUID ORGANIZATION_ID = UUID.fromString("7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001");

	private static final Set<String> SCHOOL_CODES = Set.of("PBC", "PBC-PH1", "PBC-PH2");

	private final UserRepository users;

	private final SchoolRepository schools;

	private final PasswordEncoder passwordEncoder;

	private final String configuredName;

	private final String configuredPhone;

	private final String configuredEmail;

	private final String configuredPassword;

	/**
	 * Hiệu trưởng đầu tiên của 3 trường PBC, lấy từ biến môi trường: họ tên, SĐT và/hoặc email (cần ít nhất một để
	 * đăng nhập), mật khẩu tạm (phải đổi ở lần đăng nhập đầu).
	 */
	public ProductionAdminBootstrap(UserRepository users, SchoolRepository schools, PasswordEncoder passwordEncoder,
			@Value("${BOOTSTRAP_ADMIN_NAME:Hiệu trưởng Phan Bội Châu}") String configuredName,
			@Value("${BOOTSTRAP_ADMIN_PHONE:}") String configuredPhone,
			@Value("${BOOTSTRAP_ADMIN_EMAIL:}") String configuredEmail,
			@Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String configuredPassword) {
		this.users = users;
		this.schools = schools;
		this.passwordEncoder = passwordEncoder;
		this.configuredName = configuredName;
		this.configuredPhone = configuredPhone;
		this.configuredEmail = configuredEmail;
		this.configuredPassword = configuredPassword;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		String name = configuredName == null ? "" : configuredName.trim();
		String phone = configuredPhone == null || configuredPhone.isBlank() ? null
				: AuthService.normalizePhone(configuredPhone);
		String email = configuredEmail == null || configuredEmail.isBlank() ? null
				: configuredEmail.trim().toLowerCase(Locale.ROOT);
		if (name.isEmpty() || name.length() > 200) {
			throw new IllegalStateException("BOOTSTRAP_ADMIN_NAME phải có từ 1 đến 200 ký tự.");
		}
		if (phone == null && email == null) {
			throw new IllegalStateException("Cần đặt BOOTSTRAP_ADMIN_PHONE hoặc BOOTSTRAP_ADMIN_EMAIL để hiệu trưởng đăng nhập.");
		}
		if (phone != null && !phone.matches("^0\\d{9}$")) {
			throw new IllegalStateException("BOOTSTRAP_ADMIN_PHONE phải gồm 10 chữ số, bắt đầu bằng 0.");
		}
		if (email != null && !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
			throw new IllegalStateException("BOOTSTRAP_ADMIN_EMAIL phải là địa chỉ email hợp lệ.");
		}
		if (configuredPassword == null || configuredPassword.length() < 12
				|| configuredPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
			throw new IllegalStateException("BOOTSTRAP_ADMIN_PASSWORD phải dài từ 12 đến 72 byte UTF-8.");
		}

		List<School> organizationSchools = schools.findAllByOrganizationIdAndActiveTrueOrderByCode(ORGANIZATION_ID);
		Map<String, School> schoolsByCode = organizationSchools.stream()
			.collect(Collectors.toMap(School::getCode, school -> school));
		if (!schoolsByCode.keySet().containsAll(SCHOOL_CODES)) {
			throw new IllegalStateException("Migration trường PBC phải chạy trước khi tạo tài khoản hiệu trưởng.");
		}

		User byPhone = phone == null ? null : users.findByPhone(phone).orElse(null);
		User byEmail = email == null ? null : users.findByEmail(email).orElse(null);
		if (byPhone != null && byEmail != null && byPhone != byEmail) {
			throw new IllegalStateException("BOOTSTRAP_ADMIN_PHONE và BOOTSTRAP_ADMIN_EMAIL thuộc hai tài khoản khác nhau.");
		}
		User user = byPhone != null ? byPhone : byEmail;
		if (user != null && !ORGANIZATION_ID.equals(user.getOrganizationId())) {
			throw new IllegalStateException("SĐT/email hiệu trưởng bootstrap đã được dùng ở một tổ chức khác.");
		}
		if (user != null && !user.isActive()) {
			throw new IllegalStateException("Tài khoản hiệu trưởng bootstrap hiện không hoạt động.");
		}

		if (user == null) {
			String passwordHash = passwordEncoder.encode(configuredPassword);
			user = new User(ORGANIZATION_ID, email, phone, name, passwordHash);
			user.assignPassword(passwordHash);
		}

		for (String code : SCHOOL_CODES) {
			UUID schoolId = schoolsByCode.get(code).getId();
			boolean alreadyPrincipal = user.getRoles().stream()
				.anyMatch(role -> role.getRoleCode() == RoleCode.PRINCIPAL && role.getSchoolId().equals(schoolId));
			if (!alreadyPrincipal) {
				user.addRole(RoleCode.PRINCIPAL, schoolId);
			}
		}
		users.save(user);
	}

}