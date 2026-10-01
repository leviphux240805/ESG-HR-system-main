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
		School school = schools.save(new School(TestData.DEFAULT_ORG, "SCHEMA-" + UUID.randomUUID().toString().substring(0, 8), "Trường thử"));

		assertThat(school.getId()).isNotNull();
		assertThat(school.getCreatedAt()).isNotNull();
		assertThat(school.getUpdatedAt()).isNotNull();
	}

	@Test
	void roleScopeIsEnforcedByDatabase() {
		School school = schools.save(new School(TestData.DEFAULT_ORG, "SCOPE-" + UUID.randomUUID().toString().substring(0, 8), "Trường thử"));
		User user = users.save(new User(TestData.DEFAULT_ORG, UUID.randomUUID() + "@test.local", null, "Người thử", "x"));

		// Mọi vai trò bắt buộc gắn một trường
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.ACCOUNTANT, null, null))
			.isInstanceOf(DataIntegrityViolationException.class);
		// Vai trò cũ cấp chuỗi không còn
		assertThatThrownBy(() -> jdbc.update("INSERT INTO user_roles (user_id, role_code, school_id) VALUES (?, 'OWNER', ?)",
				user.getId(), school.getId()))
			.isInstanceOf(DataIntegrityViolationException.class);
		// Nhóm chức năng: bắt buộc với phó hiệu trưởng, cấm với vai trò khác
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.VICE_PRINCIPAL, school.getId(), null))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.TEACHER, school.getId(), "{HR}"))
			.isInstanceOf(DataIntegrityViolationException.class);
		insertRole(user.getId(), RoleCode.VICE_PRINCIPAL, school.getId(), "{HR,REPORTS}");
		insertRole(user.getId(), RoleCode.ACCOUNTANT, school.getId(), null);
		// Trùng vai trò ở cùng trường bị chặn
		assertThatThrownBy(() -> insertRole(user.getId(), RoleCode.ACCOUNTANT, school.getId(), null))
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

		assertThat(jdbc.queryForObject("SELECT count(*) FROM dev_seed_check.schools", Integer.class)).isEqualTo(4);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM dev_seed_check.organizations", Integer.class)).isEqualTo(2);
		assertThat(jdbc.queryForObject("SELECT count(DISTINCT role_code) FROM dev_seed_check.user_roles", Integer.class))
			.isEqualTo(RoleCode.values().length);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM dev_seed_check.staff", Integer.class)).isEqualTo(12);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM dev_seed_check.users WHERE staff_id IS NOT NULL",
				Integer.class)).isEqualTo(6);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM dev_seed_check.staff_school_assignments", Integer.class))
			.isEqualTo(12);
	}

	private void insertRole(UUID userId, RoleCode role, UUID schoolId, String functionGroups) {
		jdbc.update("INSERT INTO user_roles (user_id, role_code, school_id, function_groups) VALUES (?, ?, ?, ?::varchar(20)[])",
				userId, role.name(), schoolId, functionGroups);
	}

}
