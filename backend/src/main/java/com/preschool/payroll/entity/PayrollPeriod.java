package com.preschool.payroll.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.payroll.entity.PayrollEnums.PeriodStatus;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Kỳ lương một tháng của một cơ sở. Đã duyệt thì khóa: không tính lại, không sửa thưởng phạt. */
@Entity
@Table(name = "payroll_periods")
@Filter(name = SchoolFilter.NAME)
public class PayrollPeriod extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	/** Ngày đầu tháng. */
	@Column(nullable = false)
	private LocalDate month;

	@Column(name = "standard_work_days", nullable = false)
	private BigDecimal standardWorkDays;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private PeriodStatus status = PeriodStatus.DRAFT;

	@Column(name = "params_id")
	private UUID paramsId;

	@Column(name = "calculated_at")
	private Instant calculatedAt;

	@Column(name = "approved_by")
	private UUID approvedBy;

	@Column(name = "approved_at")
	private Instant approvedAt;

	@Column(name = "paid_at")
	private Instant paidAt;

	private String note;

	protected PayrollPeriod() {
	}

	public PayrollPeriod(UUID schoolId, LocalDate month, BigDecimal standardWorkDays) {
		this.schoolId = schoolId;
		this.month = month;
		this.standardWorkDays = standardWorkDays;
	}

	public void calculated(UUID paramsId, BigDecimal standardWorkDays, Instant at) {
		this.paramsId = paramsId;
		this.standardWorkDays = standardWorkDays;
		this.calculatedAt = at;
	}

	public void approve(UUID userId, Instant at) {
		this.status = PeriodStatus.APPROVED;
		this.approvedBy = userId;
		this.approvedAt = at;
	}

	public void pay(Instant at) {
		this.status = PeriodStatus.PAID;
		this.paidAt = at;
	}

	/** Còn sửa được: tính lại, sửa thưởng phạt, đổi công chuẩn. */
	public boolean isEditable() {
		return status == PeriodStatus.DRAFT;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getMonth() {
		return month;
	}

	public BigDecimal getStandardWorkDays() {
		return standardWorkDays;
	}

	public PeriodStatus getStatus() {
		return status;
	}

	public UUID getParamsId() {
		return paramsId;
	}

	public Instant getCalculatedAt() {
		return calculatedAt;
	}

	public UUID getApprovedBy() {
		return approvedBy;
	}

	public Instant getApprovedAt() {
		return approvedAt;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public String getNote() {
		return note;
	}

}
