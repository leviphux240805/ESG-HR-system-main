package com.preschool.attendance.entity;

import java.math.BigDecimal;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/** Phép năm của nhân viên: số ngày được nghỉ có lương trong năm và số đã dùng. */
@Entity
@Table(name = "leave_balances")
@Filter(name = SchoolFilter.NAME)
public class LeaveBalance extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(nullable = false)
	private int year;

	@Column(name = "annual_days", nullable = false)
	private BigDecimal annualDays;

	@Column(name = "used_days", nullable = false)
	private BigDecimal usedDays = BigDecimal.ZERO;

	protected LeaveBalance() {
	}

	public LeaveBalance(UUID schoolId, UUID staffId, int year, BigDecimal annualDays) {
		this.schoolId = schoolId;
		this.staffId = staffId;
		this.year = year;
		this.annualDays = annualDays;
	}

	public BigDecimal getRemaining() {
		return annualDays.subtract(usedDays);
	}

	public void use(BigDecimal days) {
		this.usedDays = usedDays.add(days);
	}

	public void setAnnualDays(BigDecimal annualDays) {
		this.annualDays = annualDays;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public int getYear() {
		return year;
	}

	public BigDecimal getAnnualDays() {
		return annualDays;
	}

	public BigDecimal getUsedDays() {
		return usedDays;
	}

}
