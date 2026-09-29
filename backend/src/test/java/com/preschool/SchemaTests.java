package com.preschool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import javax.sql.DataSource;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@IntegrationTest
class SchemaTests {

	@Autowired
	DataSource dataSource;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	SchoolRepository schools;

	@Autowired
	UserRepository users;

	@Test
	void auditColumnsAreFilledAutomatically() {
		School school = schools.save(new School("SCHEMA-" + UUID.randomUUID().toString().substring(0, 8), "Cơ sở thử"));

		assertThat(school.getId()).isNotNull();
		assertThat(school.getCreatedAt()).isNotNull();
		assertThat(school.getUpdatedAt()).isNotNull();
	}

	@Test
	void roleScopeIsEnforcedByDatabase() {
		School school = schools.save(new School("SCOPE-" + UUID.randomUUID().toString().substring(0, 8), "Cơ sở thử"));
		User user = users.save(new User(UUID.randomUUID() + "@test.local", null, "Người thử", "x"));

		// OWNER chỉ được gán toàn chuỗi
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.OWNER, school.getId()))
			.isInstanceOf(DataIntegrityViolationException.class);
		// TEACHER bắt buộc gắn một cơ sở
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.TEACHER, null))
			.isInstanceOf(DataIntegrityViolationException.class);
		// ACCOUNTANT được cả hai kiểu
		insertRole(user.getId(), RoleCode.ACCOUNTANT, null);
		insertRole(user.getId(), RoleCode.ACCOUNTANT, school.getId());
		// Trùng vai trò toàn chuỗi (school_id rỗng) vẫn bị chặn nhờ NULLS NOT DISTINCT
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.ACCOUNTANT, null))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void devSeedMigratesCleanlyOnEmptySchema() {
		Flyway.configure()
			.dataSource(dataSource)
			.schemas("dev_seed_check")
			.createSchemas(true)
			.locations("classpath:db/migration", "classpath:db/dev")
			.load()
			.migrate();

		assertThat(jdbc.queryForObject("SELECT count(*) FROM dev_seed_check.schools", Integer.class)).isEqualTo(2);
		assertThat(jdbc.queryForObject("SELECT count(DISTINCT role_code) FROM dev_seed_check.user_roles", Integer.class))
			.isEqualTo(RoleCode.values().length);
	}

	private void insertRole(UUID userId, RoleCode role, UUID schoolId) {
		jdbc.update("INSERT INTO user_roles (user_id, role_code, school_id) VALUES (?, ?, ?)", userId, role.name(),
				schoolId);
	}

}
