package com.preschool.payroll.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.preschool.payroll.engine.PayrollCalculator.Bracket;
import com.preschool.payroll.engine.PayrollCalculator.Input;
import com.preschool.payroll.engine.PayrollCalculator.Params;
import com.preschool.payroll.engine.PayrollCalculator.Result;
import com.preschool.staff.entity.StaffEnums.SalaryMode;

import org.junit.jupiter.api.Test;

/**
 * Tính lương: mỗi ca có số đã tính tay trong phần chú thích, để đối chiếu được mà không cần chạy code.
 * Tham số dùng bộ seed của V8 (BHXH 8%, BHYT 1,5%, BHTN 1%, giảm trừ 11tr và 4,4tr, lương cơ sở 2,34tr).
 */
class PayrollCalculatorTests {

	private static final Params PARAMS = new Params(rate("0.08"), rate("0.015"), rate("0.01"), vnd(11_000_000),
			vnd(4_400_000), vnd(2_340_000), 20,
			Map.of("I", vnd(4_960_000), "II", vnd(4_410_000), "III", vnd(3_860_000), "IV", vnd(3_450_000)),
			List.of(new Bracket(vnd(5_000_000), rate("0.05")), new Bracket(vnd(10_000_000), rate("0.10")),
					new Bracket(vnd(18_000_000), rate("0.15")), new Bracket(vnd(32_000_000), rate("0.20")),
					new Bracket(vnd(52_000_000), rate("0.25")), new Bracket(vnd(80_000_000), rate("0.30")),
					new Bracket(null, rate("0.35"))));

	private static BigDecimal vnd(long value) {
		return BigDecimal.valueOf(value);
	}

	private static BigDecimal rate(String value) {
		return new BigDecimal(value);
	}

	private static Input fixed(long salary, String workDays, Map<String, BigDecimal> allowances, int dependents) {
		return new Input(new BigDecimal(workDays), vnd(26), SalaryMode.FIXED, vnd(salary), null, "I", null, allowances,
				BigDecimal.ZERO, BigDecimal.ZERO, dependents);
	}

	@Test
	void fixedSalaryFullMonthNoDependents() {
		// Lương 20.000.000, đủ 26/26 công, phụ cấp 730.000 + 500.000 = 1.230.000
		// Tổng thu nhập 21.230.000 · BH 8% + 1,5% + 1% trên 20.000.000 = 1.600.000 + 300.000 + 200.000 = 2.100.000
		// Thu nhập tính thuế 21.230.000 − 11.000.000 − 2.100.000 = 8.130.000
		// Thuế: 5.000.000 × 5% + 3.130.000 × 10% = 250.000 + 313.000 = 563.000
		// Thực lĩnh 21.230.000 − 2.100.000 − 563.000 = 18.567.000
		Result r = PayrollCalculator.calculate(
				fixed(20_000_000, "26", Map.of("anTrua", vnd(730_000), "xangXe", vnd(500_000)), 0), PARAMS);

		assertThat(r.salaryByWork()).isEqualByComparingTo(vnd(20_000_000));
		assertThat(r.allowances()).isEqualByComparingTo(vnd(1_230_000));
		assertThat(r.gross()).isEqualByComparingTo(vnd(21_230_000));
		assertThat(r.socialInsurance()).isEqualByComparingTo(vnd(1_600_000));
		assertThat(r.healthInsurance()).isEqualByComparingTo(vnd(300_000));
		assertThat(r.unemploymentInsurance()).isEqualByComparingTo(vnd(200_000));
		assertThat(r.insuranceTotal()).isEqualByComparingTo(vnd(2_100_000));
		assertThat(r.taxableIncome()).isEqualByComparingTo(vnd(8_130_000));
		assertThat(r.pit()).isEqualByComparingTo(vnd(563_000));
		assertThat(r.net()).isEqualByComparingTo(vnd(18_567_000));
	}

	@Test
	void coefficientSalaryWithMissingWorkDays() {
		// Hệ số 3,5 × lương cơ sở 2.340.000 = 8.190.000; đi làm 22/26 công → 8.190.000 × 22 / 26 = 6.930.000
		// Bảo hiểm tính trên lương hợp đồng 8.190.000, không theo công: 655.200 + 122.850 + 81.900 = 859.950
		// Giảm trừ 11.000.000 + 859.950 vượt tổng thu nhập → thuế 0
		// Thực lĩnh 6.930.000 − 859.950 = 6.070.050
		Input in = new Input(new BigDecimal("22"), vnd(26), SalaryMode.COEFFICIENT, null, new BigDecimal("3.5"), "I",
				null, Map.of(), BigDecimal.ZERO, BigDecimal.ZERO, 0);
		Result r = PayrollCalculator.calculate(in, PARAMS);

		assertThat(r.contractSalary()).isEqualByComparingTo(vnd(8_190_000));
		assertThat(r.salaryByWork()).isEqualByComparingTo(vnd(6_930_000));
		assertThat(r.insuranceBase()).isEqualByComparingTo(vnd(8_190_000));
		assertThat(r.insuranceTotal()).isEqualByComparingTo(new BigDecimal("859950"));
		assertThat(r.taxableIncome()).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(r.pit()).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(r.net()).isEqualByComparingTo(new BigDecimal("6070050"));
	}

	@Test
	void twoDependentsReduceTax() {
		// Lương 30.000.000 đủ công · BH 2.400.000 + 450.000 + 300.000 = 3.150.000
		// Giảm trừ 11.000.000 + 2 × 4.400.000 + 3.150.000 = 22.950.000
		// Thu nhập tính thuế 7.050.000 → 5.000.000 × 5% + 2.050.000 × 10% = 250.000 + 205.000 = 455.000
		// Thực lĩnh 30.000.000 − 3.150.000 − 455.000 = 26.395.000
		Result r = PayrollCalculator.calculate(fixed(30_000_000, "26", Map.of(), 2), PARAMS);

		assertThat(r.insuranceTotal()).isEqualByComparingTo(vnd(3_150_000));
		assertThat(r.totalDeduction()).isEqualByComparingTo(vnd(22_950_000));
		assertThat(r.taxableIncome()).isEqualByComparingTo(vnd(7_050_000));
		assertThat(r.pit()).isEqualByComparingTo(vnd(455_000));
		assertThat(r.net()).isEqualByComparingTo(vnd(26_395_000));
	}

	@Test
	void incomeBelowDeductionPaysNoTax() {
		// Lương 8.000.000 đủ công · BH 640.000 + 120.000 + 80.000 = 840.000
		// Giảm trừ 11.840.000 > 8.000.000 → thu nhập tính thuế 0, thuế 0
		// Thực lĩnh 8.000.000 − 840.000 = 7.160.000
		Result r = PayrollCalculator.calculate(fixed(8_000_000, "26", Map.of(), 0), PARAMS);

		assertThat(r.insuranceTotal()).isEqualByComparingTo(vnd(840_000));
		assertThat(r.taxableIncome()).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(r.pit()).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(r.net()).isEqualByComparingTo(vnd(7_160_000));
	}

	@Test
	void insuranceIsCappedForHighSalary() {
		// Lương 60.000.000 đủ công
		// Trần BHXH/BHYT = 20 × 2.340.000 = 46.800.000 → 3.744.000 + 702.000
		// Trần BHTN = 20 × 4.960.000 = 99.200.000 (không chạm) → 1% × 60.000.000 = 600.000
		// Tổng BH 5.046.000 · giảm trừ 16.046.000 · thu nhập tính thuế 43.954.000
		// Thuế: 250.000 + 500.000 + 1.200.000 + 2.800.000 + 11.954.000 × 25% (2.988.500) = 7.738.500
		// Thực lĩnh 60.000.000 − 5.046.000 − 7.738.500 = 47.215.500
		Result r = PayrollCalculator.calculate(fixed(60_000_000, "26", Map.of(), 0), PARAMS);

		assertThat(r.socialInsurance()).isEqualByComparingTo(vnd(3_744_000));
		assertThat(r.healthInsurance()).isEqualByComparingTo(vnd(702_000));
		assertThat(r.unemploymentInsurance()).isEqualByComparingTo(vnd(600_000));
		assertThat(r.insuranceTotal()).isEqualByComparingTo(vnd(5_046_000));
		assertThat(r.taxableIncome()).isEqualByComparingTo(vnd(43_954_000));
		assertThat(r.pit()).isEqualByComparingTo(new BigDecimal("7738500"));
		assertThat(r.net()).isEqualByComparingTo(new BigDecimal("47215500"));
	}

	@Test
	void bonusAndFinesChangeGrossAndTax() {
		// Lương 20.000.000 đủ công, thưởng 3.000.000, phạt 500.000 → tổng thu nhập 22.500.000
		// BH vẫn tính trên lương hợp đồng 20.000.000 = 2.100.000
		// Thu nhập tính thuế 22.500.000 − 11.000.000 − 2.100.000 = 9.400.000
		// Thuế 250.000 + 4.400.000 × 10% (440.000) = 690.000
		// Thực lĩnh 22.500.000 − 2.100.000 − 690.000 = 19.710.000
		Input in = new Input(vnd(26), vnd(26), SalaryMode.FIXED, vnd(20_000_000), null, "I", null, Map.of(),
				vnd(3_000_000), vnd(500_000), 0);
		Result r = PayrollCalculator.calculate(in, PARAMS);

		assertThat(r.gross()).isEqualByComparingTo(vnd(22_500_000));
		assertThat(r.insuranceTotal()).isEqualByComparingTo(vnd(2_100_000));
		assertThat(r.taxableIncome()).isEqualByComparingTo(vnd(9_400_000));
		assertThat(r.pit()).isEqualByComparingTo(vnd(690_000));
		assertThat(r.net()).isEqualByComparingTo(vnd(19_710_000));
	}

}
