package com.preschool.finance.entity;

import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.finance.entity.FinanceEnums.Direction;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Danh mục sổ thu chi ({@code schoolId} rỗng = dùng chung). {@code systemCode} đánh dấu danh mục của dòng tự sinh
 * (TUITION, PAYROLL), không chọn được khi nhập tay.
 */
@Entity
@Table(name = "cash_categories")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class CashCategory extends OrganizationEntity {

	public static final String TUITION = "TUITION";

	public static final String PAYROLL = "PAYROLL";

	@Column(name = "school_id")
	private UUID schoolId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Direction direction;

	@Column(nullable = false)
	private String name;

	@Column(name = "system_code")
	private String systemCode;

	@Column(nullable = false)
	private boolean active = true;

	@Column(name = "order_no", nullable = false)
	private int orderNo;

	protected CashCategory() {
	}

	public CashCategory(UUID schoolId, Direction direction, String name, int orderNo) {
		this.schoolId = schoolId;
		this.direction = direction;
		this.name = name;
		this.orderNo = orderNo;
	}

	public void update(String name, boolean active, int orderNo) {
		this.name = name;
		this.active = active;
		this.orderNo = orderNo;
	}

	public boolean isSystem() {
		return systemCode != null;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public Direction getDirection() {
		return direction;
	}

	public String getName() {
		return name;
	}

	public String getSystemCode() {
		return systemCode;
	}

	public boolean isActive() {
		return active;
	}

	public int getOrderNo() {
		return orderNo;
	}

}
