package com.preschool.payroll.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.staff.entity.StaffEnums.SalaryMode;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Phiếu lương một người trong một kỳ. Lưu đủ các dòng trung gian (lương theo công, từng loại bảo hiểm, giảm trừ,
 * thuế) để màn hình diễn giải lại được từng bước mà không phải tính lại.
 */
@Entity
@Table(name = "payroll_records")
@Filter(name = SchoolFilter.NAME)
public class PayrollRecord extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "period_id", nullable = false)
	private UUID periodId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "work_days", nullable = false)
	private BigDecimal workDays;

	@Enumerated(EnumType.STRING)
	@Column(name = "salary_mode", nullable = false)
	private SalaryMode salaryMode;

	@Column(name = "contract_salary", nullable = false)
	private BigDecimal contractSalary;

	private BigDecimal coefficient;

	@Column(name = "salary_by_work", nullable = false)
	private BigDecimal salaryByWork;

	@Column(nullable = false)
	private BigDecimal allowances = BigDecimal.ZERO;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "allowances_detail", nullable = false)
	private String allowancesDetail = "{}";

	@Column(nullable = false)
	private BigDecimal bonus = BigDecimal.ZERO;

	@Column(nullable = false)
	private BigDecimal fines = BigDecimal.ZERO;

	@Column(name = "gross_salary", nullable = false)
	private BigDecimal grossSalary;

	@Column(name = "insurance_base", nullable = false)
	private BigDecimal insuranceBase = BigDecimal.ZERO;

	@Column(name = "social_insurance", nullable = false)
	private BigDecimal socialInsurance = BigDecimal.ZERO;

	@Column(name = "health_insurance", nullable = false)
	private BigDecimal healthInsurance = BigDecimal.ZERO;

	@Column(name = "unemployment_insurance", nullable = false)
	private BigDecimal unemploymentInsurance = BigDecimal.ZERO;

	@Column(name = "insurance_deduction", nullable = false)
	private BigDecimal insuranceDeduction = BigDecimal.ZERO;

	@Column(name = "dependent_count", nullable = false)
	private int dependentCount;

	@Column(name = "total_deduction", nullable = false)
	private BigDecimal totalDeduction = BigDecimal.ZERO;

	@Column(name = "taxable_income", nullable = false)
	private BigDecimal taxableIncome = BigDecimal.ZERO;

	@Column(nullable = false)
	private BigDecimal pit = BigDecimal.ZERO;

	@Column(name = "net_salary", nullable = false)
	private BigDecimal netSalary;

	private String note;

	@Column(name = "paid_at")
	private Instant paidAt;

	@Column(name = "email_sent_at")
	private Instant emailSentAt;

	@Column(name = "payslip_file_id")
	private UUID payslipFileId;

	protected PayrollRecord() {
	}

	public PayrollRecord(UUID schoolId, UUID periodId, UUID staffId) {
		this.schoolId = schoolId;
		this.periodId = periodId;
		this.staffId = staffId;
	}

	/** Thưởng và phạt do kế toán nhập; giữ lại khi tính lại kỳ lương. */
	public void setAdjustments(BigDecimal bonus, BigDecimal fines, String note) {
		this.bonus = bonus;
		this.fines = fines;
		this.note = note;
	}

	public void markPaid(Instant at) {
		this.paidAt = at;
	}

	public void markEmailSent(Instant at) {
		this.emailSentAt = at;
	}

	public void setPayslipFileId(UUID payslipFileId) {
		this.payslipFileId = payslipFileId;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getPeriodId() {
		return periodId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public BigDecimal getWorkDays() {
		return workDays;
	}

	public SalaryMode getSalaryMode() {
		return salaryMode;
	}

	public BigDecimal getContractSalary() {
		return contractSalary;
	}

	public BigDecimal getCoefficient() {
		return coefficient;
	}

	public BigDecimal getSalaryByWork() {
		return salaryByWork;
	}

	public BigDecimal getAllowances() {
		return allowances;
	}

	public String getAllowancesDetail() {
		return allowancesDetail;
	}

	public BigDecimal getBonus() {
		return bonus;
	}

	public BigDecimal getFines() {
		return fines;
	}

	public BigDecimal getGrossSalary() {
		return grossSalary;
	}

	public BigDecimal getInsuranceBase() {
		return insuranceBase;
	}

	public BigDecimal getSocialInsurance() {
		return socialInsurance;
	}

	public BigDecimal getHealthInsurance() {
		return healthInsurance;
	}

	public BigDecimal getUnemploymentInsurance() {
		return unemploymentInsurance;
	}

	public BigDecimal getInsuranceDeduction() {
		return insuranceDeduction;
	}

	public int getDependentCount() {
		return dependentCount;
	}

	public BigDecimal getTotalDeduction() {
		return totalDeduction;
	}

	public BigDecimal getTaxableIncome() {
		return taxableIncome;
	}

	public BigDecimal getPit() {
		return pit;
	}

	public BigDecimal getNetSalary() {
		return netSalary;
	}

	public String getNote() {
		return note;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public Instant getEmailSentAt() {
		return emailSentAt;
	}

	public UUID getPayslipFileId() {
		return payslipFileId;
	}

	/** Ghi kết quả tính lương (các trường tính ra chỉ đổi qua đây, để không lệch giữa các dòng). */
	public void applyCalculation(BigDecimal workDays, SalaryMode salaryMode, BigDecimal contractSalary,
			BigDecimal coefficient, BigDecimal salaryByWork, BigDecimal allowances, String allowancesDetail,
			BigDecimal grossSalary, BigDecimal insuranceBase, BigDecimal socialInsurance, BigDecimal healthInsurance,
			BigDecimal unemploymentInsurance, BigDecimal insuranceDeduction, int dependentCount,
			BigDecimal totalDeduction, BigDecimal taxableIncome, BigDecimal pit, BigDecimal netSalary) {
		this.workDays = workDays;
		this.salaryMode = salaryMode;
		this.contractSalary = contractSalary;
		this.coefficient = coefficient;
		this.salaryByWork = salaryByWork;
		this.allowances = allowances;
		this.allowancesDetail = allowancesDetail == null ? "{}" : allowancesDetail;
		this.grossSalary = grossSalary;
		this.insuranceBase = insuranceBase;
		this.socialInsurance = socialInsurance;
		this.healthInsurance = healthInsurance;
		this.unemploymentInsurance = unemploymentInsurance;
		this.insuranceDeduction = insuranceDeduction;
		this.dependentCount = dependentCount;
		this.totalDeduction = totalDeduction;
		this.taxableIncome = taxableIncome;
		this.pit = pit;
		this.netSalary = netSalary;
	}

}
