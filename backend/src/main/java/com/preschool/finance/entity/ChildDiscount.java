package com.preschool.finance.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Miễn giảm của trẻ theo % hoặc số tiền, có thời hạn theo tháng. {@code feeTypeId} rỗng = giảm trên tổng các khoản
 * thu của tháng.
 */
@Entity
@Table(name = "child_discounts")
@Filter(name = SchoolFilter.NAME)
public class ChildDiscount extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "fee_type_id")
	private UUID feeTypeId;

	private BigDecimal percent;

	private BigDecimal amount;

	@Column(nullable = false)
	private String reason;

	@Column(name = "from_month", nullable = false)
	private LocalDate fromMonth;

	@Column(name = "to_month")
	private LocalDate toMonth;

	protected ChildDiscount() {
	}

	public ChildDiscount(UUID schoolId, UUID childId) {
		this.schoolId = schoolId;
		this.childId = childId;
	}

	public void update(UUID feeTypeId, BigDecimal percent, BigDecimal amount, String reason, LocalDate fromMonth,
			LocalDate toMonth) {
		this.feeTypeId = feeTypeId;
		this.percent = percent;
		this.amount = amount;
		this.reason = reason;
		this.fromMonth = fromMonth;
		this.toMonth = toMonth;
	}

	public boolean covers(LocalDate month) {
		return !fromMonth.isAfter(month) && (toMonth == null || !toMonth.isBefore(month));
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getChildId() {
		return childId;
	}

	public UUID getFeeTypeId() {
		return feeTypeId;
	}

	public BigDecimal getPercent() {
		return percent;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public String getReason() {
		return reason;
	}

	public LocalDate getFromMonth() {
		return fromMonth;
	}

	public LocalDate getToMonth() {
		return toMonth;
	}

}
