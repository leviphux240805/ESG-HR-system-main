package com.preschool.payroll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.preschool.IntegrationTest;
import com.preschool.TestData;
import com.preschool.payroll.engine.PayrollCalculator;
import com.preschool.payroll.engine.PayrollCalculator.Bracket;
import com.preschool.payroll.entity.PayrollParams;
import com.preschool.payroll.repository.PayrollParamsRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Ràng buộc schema lương (V8) và bộ tham số seed đọc được thành biểu thuế dùng cho máy tính lương. */
@IntegrationTest
class PayrollSchemaTests {

	@Autowired
	TestData data;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	PayrollParamsRepository params;

	@Autowired
	JsonMapper jsonMapper;

	private UUID period(School school, String month) {
		return jdbc.queryForObject("""
				INSERT INTO payroll_periods (school_id, month, standard_work_days) VALUES (?, ?::date, 26)
				RETURNING id""", UUID.class, school.getId(), month);
	}

	@Test
	void seededParamsParseIntoSevenTaxBrackets() {
		PayrollParams seeded = params.findAllByOrderByEffectiveFromDesc().getLast();
		assertThat(seeded.getSocialInsuranceRate()).isEqualByComparingTo(new BigDecimal("0.08"));
		assertThat(seeded.getPersonalDeduction()).isEqualByComparingTo(new BigDecimal("11000000"));
		assertThat(seeded.getNote()).contains("đối chiếu");

		List<Bracket> brackets = jsonMapper.readValue(seeded.getPitBrackets(), new TypeReference<List<Bracket>>() {
		});
		assertThat(brackets).hasSize(7);
		assertThat(brackets.getLast().upTo()).isNull();
		// 8.130.000 đồng thu nhập tính thuế → 250.000 + 313.000 (đối chiếu với PayrollCalculatorTests)
		assertThat(PayrollCalculator.progressiveTax(new BigDecimal("8130000"), brackets))
			.isEqualByComparingTo(new BigDecimal("563000"));

		Object regions = jsonMapper.readValue(seeded.getRegionMinWages(), new TypeReference<Object>() {
		});
		assertThat(regions.toString()).contains("4960000");
	}

	@Test
	void oneParamsVersionPerEffectiveDate() {
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO payroll_params (effective_from, social_insurance_rate, health_insurance_rate,
				  unemployment_insurance_rate, personal_deduction, dependent_deduction, base_salary, pit_brackets)
				VALUES ('2024-07-01', 0.08, 0.015, 0.01, 11000000, 4400000, 2340000, '[]'::jsonb)"""))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void onePeriodPerSchoolPerMonthAndStatusIsChecked() {
		School school = data.school();
		period(school, "2026-09-01");
		assertThatThrownBy(() -> period(school, "2026-09-01")).isInstanceOf(DataIntegrityViolationException.class);
		// Cơ sở khác cùng tháng thì được
		period(data.school(), "2026-09-01");

		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO payroll_periods (school_id, month, standard_work_days, status)
				VALUES (?, '2026-10-01', 26, 'DA_TRA')""", school.getId()))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO payroll_periods (school_id, month, standard_work_days)
				VALUES (?, '2026-11-01', 0)""", school.getId()))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void onePayrollRecordPerStaffPerPeriod() {
		School school = data.school();
		Staff staff = data.staff(school, Position.TEACHER);
		UUID periodId = period(school, "2026-09-01");

		jdbc.update("""
				INSERT INTO payroll_records (school_id, period_id, staff_id, work_days, salary_mode, contract_salary,
				  salary_by_work, gross_salary, net_salary)
				VALUES (?, ?, ?, 26, 'FIXED', 20000000, 20000000, 20000000, 17900000)""", school.getId(), periodId,
				staff.getId());
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO payroll_records (school_id, period_id, staff_id, work_days, salary_mode, contract_salary,
				  salary_by_work, gross_salary, net_salary)
				VALUES (?, ?, ?, 26, 'FIXED', 20000000, 20000000, 20000000, 17900000)""", school.getId(), periodId,
				staff.getId()))
			.isInstanceOf(DataIntegrityViolationException.class);

		// Xóa kỳ lương thì phiếu trong kỳ đi theo
		jdbc.update("DELETE FROM payroll_periods WHERE id = ?", periodId);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM payroll_records WHERE period_id = ?", Integer.class,
				periodId)).isZero();
	}

}
