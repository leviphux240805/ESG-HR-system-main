package com.preschool.finance.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Mức thu của một khoản theo cơ sở, năm học và khối ({@code ageGroupId} rỗng = mọi khối). Chỉ thêm bản mới theo
 * {@code effectiveFrom}, không sửa đè (quy tắc 5).
 */
@Entity
@Table(name = "fee_schedules")
@Filter(name = SchoolFilter.NAME)
@Immutable
public class FeeSchedule extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "school_year_id", nullable = false)
	private UUID schoolYearId;

	@Column(name = "age_group_id")
	private UUID ageGroupId;

	@Column(name = "fee_type_id", nullable = false)
	private UUID feeTypeId;

	@Column(nullable = false)
	private BigDecimal amount;

	@Column(name = "effective_from", nullable = false)
	private LocalDate effectiveFrom;

	private String note;

	protected FeeSchedule() {
	}

	public FeeSchedule(UUID schoolId, UUID schoolYearId, UUID ageGroupId, UUID feeTypeId, BigDecimal amount,
			LocalDate effectiveFrom, String note) {
		this.schoolId = schoolId;
		this.schoolYearId = schoolYearId;
		this.ageGroupId = ageGroupId;
		this.feeTypeId = feeTypeId;
		this.amount = amount;
		this.effectiveFrom = effectiveFrom;
		this.note = note;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getSchoolYearId() {
		return schoolYearId;
	}

	public UUID getAgeGroupId() {
		return ageGroupId;
	}

	public UUID getFeeTypeId() {
		return feeTypeId;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public LocalDate getEffectiveFrom() {
		return effectiveFrom;
	}

	public String getNote() {
		return note;
	}

}
