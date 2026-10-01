package com.preschool.finance.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.finance.entity.FinanceEnums.MealRefundRule;
import com.preschool.finance.entity.FinanceEnums.Proration;

import org.hibernate.annotations.Immutable;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Quy tắc sinh phiếu thu của cơ sở ({@code schoolId} rỗng = mặc định của tổ chức). Chỉ thêm bản mới theo
 * {@code effectiveFrom} (quy tắc 5).
 */
@Entity
@Table(name = "finance_configs")
@Filter(name = OrganizationFilter.NAME)
@Immutable
public class FinanceConfig extends OrganizationEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "effective_from", nullable = false)
	private LocalDate effectiveFrom;

	@Enumerated(EnumType.STRING)
	@Column(name = "meal_refund_rule", nullable = false)
	private MealRefundRule mealRefundRule;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Proration proration;

	@Column(name = "due_day", nullable = false)
	private int dueDay;

	protected FinanceConfig() {
	}

	public FinanceConfig(UUID schoolId, LocalDate effectiveFrom, MealRefundRule mealRefundRule, Proration proration,
			int dueDay) {
		this.schoolId = schoolId;
		this.effectiveFrom = effectiveFrom;
		this.mealRefundRule = mealRefundRule;
		this.proration = proration;
		this.dueDay = dueDay;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getEffectiveFrom() {
		return effectiveFrom;
	}

	public MealRefundRule getMealRefundRule() {
		return mealRefundRule;
	}

	public Proration getProration() {
		return proration;
	}

	public int getDueDay() {
		return dueDay;
	}

}
