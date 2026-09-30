package com.preschool.staff.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.staff.entity.StaffEnums.SalaryMode;
import com.preschool.staff.entity.StaffEnums.SalaryRegion;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Cấu hình lương có ngày hiệu lực. Chỉ thêm bản mới, không sửa đè (Hibernate không cập nhật bản đã lưu), nên lịch
 * sử điều chỉnh lương tự có. Phụ cấp lưu JSON: {"lunch": 730000, "transport": 0, …}.
 */
@Entity
@Immutable
@Table(name = "staff_salary_configs")
public class StaffSalaryConfig extends BaseEntity {

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "effective_from", nullable = false)
	private LocalDate effectiveFrom;

	@Enumerated(EnumType.STRING)
	@Column(name = "salary_mode", nullable = false)
	private SalaryMode salaryMode;

	@Column(name = "base_salary")
	private BigDecimal baseSalary;

	private BigDecimal coefficient;

	@Enumerated(EnumType.STRING)
	private SalaryRegion region;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private String allowances = "{}";

	@Column(name = "insurance_salary")
	private BigDecimal insuranceSalary;

	private String note;

	protected StaffSalaryConfig() {
	}

	public StaffSalaryConfig(UUID staffId, LocalDate effectiveFrom, SalaryMode salaryMode, BigDecimal baseSalary,
			BigDecimal coefficient, SalaryRegion region, String allowances, BigDecimal insuranceSalary, String note) {
		this.staffId = staffId;
		this.effectiveFrom = effectiveFrom;
		this.salaryMode = salaryMode;
		this.baseSalary = baseSalary;
		this.coefficient = coefficient;
		this.region = region;
		this.allowances = allowances == null ? "{}" : allowances;
		this.insuranceSalary = insuranceSalary;
		this.note = note;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public LocalDate getEffectiveFrom() {
		return effectiveFrom;
	}

	public SalaryMode getSalaryMode() {
		return salaryMode;
	}

	public BigDecimal getBaseSalary() {
		return baseSalary;
	}

	public BigDecimal getCoefficient() {
		return coefficient;
	}

	public SalaryRegion getRegion() {
		return region;
	}

	public String getAllowances() {
		return allowances;
	}

	public BigDecimal getInsuranceSalary() {
		return insuranceSalary;
	}

	public String getNote() {
		return note;
	}

}
