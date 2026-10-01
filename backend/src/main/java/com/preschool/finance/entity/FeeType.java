package com.preschool.finance.entity;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.finance.entity.FinanceEnums.CalcMethod;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Khoản thu (danh mục chung của tổ chức). Mức thu nằm ở biểu phí từng cơ sở. */
@Entity
@Table(name = "fee_types")
@Filter(name = OrganizationFilter.NAME)
public class FeeType extends OrganizationEntity {

	@Column(nullable = false)
	private String code;

	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(name = "calc_method", nullable = false)
	private CalcMethod calcMethod;

	@Column(name = "refundable_on_absence", nullable = false)
	private boolean refundableOnAbsence;

	@Column(nullable = false)
	private boolean active = true;

	@Column(name = "order_no", nullable = false)
	private int orderNo;

	protected FeeType() {
	}

	public FeeType(String code, String name, CalcMethod calcMethod, boolean refundableOnAbsence, int orderNo) {
		this.code = code;
		this.calcMethod = calcMethod;
		update(name, refundableOnAbsence, true, orderNo);
	}

	/** Không đổi mã và cách tính sau khi tạo (phiếu cũ đã tính theo cách này). */
	public void update(String name, boolean refundableOnAbsence, boolean active, int orderNo) {
		this.name = name;
		this.refundableOnAbsence = refundableOnAbsence && calcMethod == CalcMethod.PER_DAY;
		this.active = active;
		this.orderNo = orderNo;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public CalcMethod getCalcMethod() {
		return calcMethod;
	}

	public boolean isRefundableOnAbsence() {
		return refundableOnAbsence;
	}

	public boolean isActive() {
		return active;
	}

	public int getOrderNo() {
		return orderNo;
	}

}
