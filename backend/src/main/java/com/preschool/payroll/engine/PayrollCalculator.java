package com.preschool.payroll.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.preschool.staff.entity.StaffEnums.SalaryMode;

/**
 * Tính lương một người trong một tháng. Thuần Java, không chạm DB, nên đối chiếu tay được từng dòng.
 *
 * <p>Thứ tự tính (giữ luồng ESG rồi bổ sung phần bảo hiểm và thuế):
 * <ol>
 * <li>Lương tháng đầy đủ: lương cứng, hoặc hệ số × lương cơ sở</li>
 * <li>Lương theo công = lương tháng × công thực tế / công chuẩn</li>
 * <li>Tổng thu nhập = lương theo công + phụ cấp + thưởng − phạt</li>
 * <li>Bảo hiểm phần người lao động, tính trên mức đóng theo hợp đồng (không theo công) và có trần</li>
 * <li>Thu nhập tính thuế = tổng thu nhập − bảo hiểm − giảm trừ bản thân − giảm trừ người phụ thuộc</li>
 * <li>Thuế TNCN lũy tiến từng phần; thực lĩnh = tổng thu nhập − bảo hiểm − thuế</li>
 * </ol>
 *
 * <p>Phụ cấp không chia theo ngày công (đúng cách ESG đang làm). Mọi số tiền làm tròn tới đồng.
 */
public final class PayrollCalculator {

	private PayrollCalculator() {
	}

	/** Một bậc thuế; {@code upTo} rỗng = bậc cuối, không giới hạn trên. */
	public record Bracket(BigDecimal upTo, BigDecimal rate) {
	}

	/**
	 * Tham số theo ngày hiệu lực (từ {@code payroll_params}).
	 *
	 * @param baseSalary lương cơ sở: dùng cho lương hệ số và trần đóng BHXH/BHYT
	 * @param capMultiplier hệ số trần đóng bảo hiểm (thường 20 lần)
	 * @param regionMinWages lương tối thiểu vùng, dùng cho trần đóng BHTN
	 */
	public record Params(BigDecimal socialRate, BigDecimal healthRate, BigDecimal unemploymentRate,
			BigDecimal personalDeduction, BigDecimal dependentDeduction, BigDecimal baseSalary, int capMultiplier,
			Map<String, BigDecimal> regionMinWages, List<Bracket> brackets) {
	}

	/**
	 * Đầu vào của một người.
	 *
	 * @param insuranceSalary mức lương đóng bảo hiểm đã khai; rỗng thì lấy lương tháng đầy đủ
	 * @param region vùng lương tối thiểu (I–IV), để tính trần đóng BHTN
	 */
	public record Input(BigDecimal workDays, BigDecimal standardWorkDays, SalaryMode salaryMode, BigDecimal baseSalary,
			BigDecimal coefficient, String region, BigDecimal insuranceSalary, Map<String, BigDecimal> allowances,
			BigDecimal bonus, BigDecimal fines, int dependentCount) {
	}

	/** Kết quả, giữ đủ các dòng trung gian để phiếu lương diễn giải lại được. */
	public record Result(BigDecimal contractSalary, BigDecimal salaryByWork, BigDecimal allowances,
			Map<String, BigDecimal> allowancesDetail, BigDecimal gross, BigDecimal insuranceBase,
			BigDecimal socialInsurance, BigDecimal healthInsurance, BigDecimal unemploymentInsurance,
			BigDecimal insuranceTotal, BigDecimal totalDeduction, BigDecimal taxableIncome, BigDecimal pit,
			BigDecimal net) {
	}

	public static Result calculate(Input in, Params params) {
		BigDecimal contractSalary = contractSalary(in, params);
		BigDecimal salaryByWork = money(contractSalary.multiply(nz(in.workDays()))
			.divide(in.standardWorkDays(), 10, RoundingMode.HALF_UP));

		Map<String, BigDecimal> allowanceDetail = new LinkedHashMap<>();
		BigDecimal allowances = BigDecimal.ZERO;
		for (Map.Entry<String, BigDecimal> entry : in.allowances() == null ? Map.<String, BigDecimal>of().entrySet()
				: in.allowances().entrySet()) {
			BigDecimal value = money(nz(entry.getValue()));
			allowanceDetail.put(entry.getKey(), value);
			allowances = allowances.add(value);
		}

		BigDecimal gross = salaryByWork.add(allowances).add(money(nz(in.bonus()))).subtract(money(nz(in.fines())));

		// Mức đóng bảo hiểm theo hợp đồng, không theo số công thực tế
		BigDecimal insuranceBase = in.insuranceSalary() != null ? money(in.insuranceSalary()) : contractSalary;
		BigDecimal socialCap = params.baseSalary().multiply(BigDecimal.valueOf(params.capMultiplier()));
		BigDecimal socialBase = insuranceBase.min(socialCap);
		BigDecimal unemploymentBase = insuranceBase;
		BigDecimal regionWage = params.regionMinWages() == null ? null : params.regionMinWages().get(in.region());
		if (regionWage != null) {
			unemploymentBase = insuranceBase.min(regionWage.multiply(BigDecimal.valueOf(params.capMultiplier())));
		}
		BigDecimal social = money(socialBase.multiply(params.socialRate()));
		BigDecimal health = money(socialBase.multiply(params.healthRate()));
		BigDecimal unemployment = money(unemploymentBase.multiply(params.unemploymentRate()));
		BigDecimal insuranceTotal = social.add(health).add(unemployment);

		BigDecimal deduction = params.personalDeduction()
			.add(params.dependentDeduction().multiply(BigDecimal.valueOf(in.dependentCount())))
			.add(insuranceTotal);
		BigDecimal taxable = gross.subtract(deduction).max(BigDecimal.ZERO);
		BigDecimal pit = progressiveTax(taxable, params.brackets());
		BigDecimal net = gross.subtract(insuranceTotal).subtract(pit);

		return new Result(contractSalary, salaryByWork, allowances, allowanceDetail, gross, insuranceBase, social,
				health, unemployment, insuranceTotal, deduction, taxable, pit, net);
	}

	/** Lương tháng đầy đủ trước khi chia theo công. */
	private static BigDecimal contractSalary(Input in, Params params) {
		if (in.salaryMode() == SalaryMode.COEFFICIENT) {
			return money(nz(in.coefficient()).multiply(params.baseSalary()));
		}
		return money(nz(in.baseSalary()));
	}

	/** Thuế lũy tiến từng phần: mỗi bậc chỉ tính trên phần thu nhập nằm trong bậc đó. */
	public static BigDecimal progressiveTax(BigDecimal taxableIncome, List<Bracket> brackets) {
		if (taxableIncome.signum() <= 0 || brackets == null || brackets.isEmpty()) {
			return BigDecimal.ZERO;
		}
		BigDecimal tax = BigDecimal.ZERO;
		BigDecimal lower = BigDecimal.ZERO;
		for (Bracket bracket : brackets) {
			BigDecimal upper = bracket.upTo() == null ? taxableIncome : bracket.upTo().min(taxableIncome);
			if (upper.compareTo(lower) > 0) {
				tax = tax.add(upper.subtract(lower).multiply(bracket.rate()));
			}
			if (bracket.upTo() != null && taxableIncome.compareTo(bracket.upTo()) <= 0) {
				break;
			}
			lower = bracket.upTo() == null ? taxableIncome : bracket.upTo();
		}
		return money(tax);
	}

	/** Làm tròn tới đồng. */
	private static BigDecimal money(BigDecimal value) {
		return value.setScale(0, RoundingMode.HALF_UP);
	}

	private static BigDecimal nz(BigDecimal value) {
		return value == null ? BigDecimal.ZERO : value;
	}

}
