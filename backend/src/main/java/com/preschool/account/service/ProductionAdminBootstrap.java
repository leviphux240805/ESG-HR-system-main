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

	private final String configuredEmail;

	private final String configuredPassword;

	public ProductionAdminBootstrap(UserRepository users, SchoolRepository schools, PasswordEncoder passwordEncoder,
			@Value("${BOOTSTRAP_ADMIN_EMAIL:}") String configuredEmail,
			@Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String configuredPassword) {
		this.users = users;
		this.schools = schools;
		this.passwordEncoder = passwordEncoder;
		this.configuredEmail = configuredEmail;
		this.configuredPassword = configuredPassword;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		String email = configuredEmail.trim().toLowerCase(Locale.ROOT);
		if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
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

		User user = users.findByEmail(email).orElse(null);
		if (user != null && !ORGANIZATION_ID.equals(user.getOrganizationId())) {
			throw new IllegalStateException("BOOTSTRAP_ADMIN_EMAIL đã được dùng ở một tổ chức khác.");
		}
		if (user != null && !user.isActive()) {
			throw new IllegalStateException("Tài khoản hiệu trưởng bootstrap hiện không hoạt động.");
		}

		if (user == null) {
			String passwordHash = passwordEncoder.encode(configuredPassword);
			user = new User(ORGANIZATION_ID, email, null, "Hiệu trưởng Phan Bội Châu", passwordHash);
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