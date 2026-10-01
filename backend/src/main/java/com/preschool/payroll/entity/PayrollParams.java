package com.preschool.payroll.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.preschool.common.jpa.BaseEntity;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Tỷ lệ bảo hiểm, mức giảm trừ gia cảnh và biểu thuế TNCN theo ngày hiệu lực. Do pháp luật quy định nên dùng chung
 * cả tổ chức. Chỉ thêm bản mới, không sửa đè (quy tắc 5).
 */
@Entity
@Table(name = "payroll_params")
@Immutable
public class PayrollParams extends BaseEntity {

	@Column(name = "effective_from", nullable = false)
	private LocalDate effectiveFrom;

	@Column(name = "social_insurance_rate", nullable = false)
	private BigDecimal socialInsuranceRate;

	@Column(name = "health_insurance_rate", nullable = false)
	private BigDecimal healthInsuranceRate;

	@Column(name = "unemployment_insurance_rate", nullable = false)
	private BigDecimal unemploymentInsuranceRate;

	@Column(name = "personal_deduction", nullable = false)
	private BigDecimal personalDeduction;

	@Column(name = "dependent_deduction", nullable = false)
	private BigDecimal dependentDeduction;

	/** Lương cơ sở, dùng cho lương hệ số và trần đóng BHXH/BHYT. */
	@Column(name = "base_salary", nullable = false)
	private BigDecimal baseSalary;

	@Column(name = "insurance_cap_multiplier", nullable = false)
	private int insuranceCapMultiplier = 20;

	/** Lương tối thiểu vùng {"I": 4960000, …}, dùng cho trần đóng BHTN. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "region_min_wages", nullable = false)
	private String regionMinWages = "{}";

	/** Biểu thuế lũy tiến: [{"upTo": 5000000, "rate": 0.05}, …]. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "pit_brackets", nullable = false)
	private String pitBrackets;

	private String note;

	protected PayrollParams() {
	}

	public PayrollParams(LocalDate effectiveFrom, BigDecimal socialInsuranceRate, BigDecimal healthInsuranceRate,
			BigDecimal unemploymentInsuranceRate, BigDecimal personalDeduction, BigDecimal dependentDeduction,
			BigDecimal baseSalary, int insuranceCapMultiplier, String regionMinWages, String pitBrackets, String note) {
		this.effectiveFrom = effectiveFrom;
		this.socialInsuranceRate = socialInsuranceRate;
		this.healthInsuranceRate = healthInsuranceRate;
		this.unemploymentInsuranceRate = unemploymentInsuranceRate;
		this.personalDeduction = personalDeduction;
		this.dependentDeduction = dependentDeduction;
		this.baseSalary = baseSalary;
		this.insuranceCapMultiplier = insuranceCapMultiplier;
		this.regionMinWages = regionMinWages == null ? "{}" : regionMinWages;
		this.pitBrackets = pitBrackets;
		this.note = note;
	}

	public LocalDate getEffectiveFrom() {
		return effectiveFrom;
	}

	public BigDecimal getSocialInsuranceRate() {
		return socialInsuranceRate;
	}

	public BigDecimal getHealthInsuranceRate() {
		return healthInsuranceRate;
	}

	public BigDecimal getUnemploymentInsuranceRate() {
		return unemploymentInsuranceRate;
	}

	public BigDecimal getPersonalDeduction() {
		return personalDeduction;
	}

	public BigDecimal getDependentDeduction() {
		return dependentDeduction;
	}

	public BigDecimal getBaseSalary() {
		return baseSalary;
	}

	public int getInsuranceCapMultiplier() {
		return insuranceCapMultiplier;
	}

	public String getRegionMinWages() {
		return regionMinWages;
	}

	public String getPitBrackets() {
		return pitBrackets;
	}

	public String getNote() {
		return note;
	}

}
