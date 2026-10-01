package com.preschool.finance.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Khoản tự chọn trẻ đăng ký (năng khiếu…), theo tháng; {@code toMonth} rỗng = đến khi hủy đăng ký. */
@Entity
@Table(name = "child_fee_items")
@Filter(name = SchoolFilter.NAME)
public class ChildFeeItem extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "fee_type_id", nullable = false)
	private UUID feeTypeId;

	@Column(name = "from_month", nullable = false)
	private LocalDate fromMonth;

	@Column(name = "to_month")
	private LocalDate toMonth;

	private String note;

	protected ChildFeeItem() {
	}

	public ChildFeeItem(UUID schoolId, UUID childId, UUID feeTypeId) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.feeTypeId = feeTypeId;
	}

	public void update(LocalDate fromMonth, LocalDate toMonth, String note) {
		this.fromMonth = fromMonth;
		this.toMonth = toMonth;
		this.note = note;
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

	public LocalDate getFromMonth() {
		return fromMonth;
	}

	public LocalDate getToMonth() {
		return toMonth;
	}

	public String getNote() {
		return note;
	}

}
