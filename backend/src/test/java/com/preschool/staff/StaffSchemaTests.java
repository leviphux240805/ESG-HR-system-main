package com.preschool.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import com.preschool.IntegrationTest;
import com.preschool.TestData;
import com.preschool.common.audit.AuditLog;
import com.preschool.common.audit.AuditLogRepository;
import com.preschool.common.audit.AuditService;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.SalaryMode;
import com.preschool.staff.entity.StaffEnums.SalaryRegion;
import com.preschool.staff.entity.StaffSalaryConfig;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

@IntegrationTest
class StaffSchemaTests {

	@Autowired
	TestData data;

	@Autowired
	EntityManager em;

	@Autowired
	TransactionTemplate tx;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	AuditService audit;

	@Autowired
	AuditLogRepository auditLogs;

	private static String randomCitizenId() {
		return String.format("%012d", ThreadLocalRandom.current().nextLong(1_000_000_000_000L));
	}

	private Staff persistStaff(School school, String citizenId) {
		return tx.execute(s -> {
			Staff staff = new Staff(school.getId(), "Người thử", Position.TEACHER, LocalDate.of(2024, 8, 1));
			staff.setCitizenId(citizenId);
			em.persist(staff);
			em.flush();
			em.refresh(staff);
			return staff;
		});
	}

	@Test
	void staffCodeIsGeneratedAndCitizenIdIsUniqueAmongActiveProfiles() {
		School school = data.school();
		String citizenId = randomCitizenId();
		Staff staff = persistStaff(school, citizenId);

		assertThat(staff.getStaffCode()).matches("NV\\d{4,}");
		// Gọi EntityManager trực tiếp nên lỗi chưa được Spring chuyển thành DataIntegrityViolationException
		assertThatThrownBy(() -> persistStaff(school, citizenId)).hasMessageContaining("staff_citizen_id_uq");

		// Hồ sơ đã xóa mềm không chặn CCCD
		jdbc.update("UPDATE staff SET deleted_at = now() WHERE id = ?", staff.getId());
		assertThat(persistStaff(school, citizenId).getId()).isNotEqualTo(staff.getId());
	}

	@Test
	void salaryConfigStoresAllowancesJsonAndIsNeverUpdated() {
		Staff staff = persistStaff(data.school(), randomCitizenId());
		UUID configId = tx.execute(s -> {
			StaffSalaryConfig config = new StaffSalaryConfig(staff.getId(), LocalDate.of(2026, 1, 1), SalaryMode.FIXED,
					new BigDecimal("8500000"), null, SalaryRegion.I, "{\"lunch\": 730000}", null, null);
			em.persist(config);
			return config.getId();
		});

		String allowances = jdbc.queryForObject("SELECT allowances->>'lunch' FROM staff_salary_configs WHERE id = ?",
				String.class, configId);
		assertThat(allowances).isEqualTo("730000");

		// Cùng ngày hiệu lực bị chặn: điều chỉnh lương phải là bản mới với ngày khác
		assertThatThrownBy(() -> tx.executeWithoutResult(s -> em.persist(new StaffSalaryConfig(staff.getId(),
				LocalDate.of(2026, 1, 1), SalaryMode.FIXED, new BigDecimal("9000000"), null, SalaryRegion.I, null,
				null, null))))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void auditLogStoresBeforeAndAfterAsJson() {
		UUID entityId = UUID.randomUUID();
		tx.executeWithoutResult(s -> audit.record("staff", entityId, AuditLog.Action.UPDATE,
				java.util.Map.of("phone", "0900000001"), java.util.Map.of("phone", "0900000002")));

		AuditLog log = auditLogs.findByEntityInAndEntityIdInOrderByCreatedAtDesc(java.util.List.of("staff"),
				java.util.List.of(entityId)).getFirst();
		assertThat(log.getBeforeData()).contains("0900000001");
		assertThat(jdbc.queryForObject("SELECT after_data->>'phone' FROM audit_logs WHERE entity_id = ?", String.class,
				entityId)).isEqualTo("0900000002");
	}

}
