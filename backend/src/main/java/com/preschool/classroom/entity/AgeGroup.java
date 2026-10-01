package com.preschool.classroom.entity;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Khối theo độ tuổi (danh mục chung của tổ chức): nhà trẻ, mẫu giáo 3–4, 4–5, 5–6 tuổi. Sĩ số tối đa theo Điều lệ
 * trường mầm non, sửa được khi văn bản thay đổi nên không viết cứng trong code.
 */
@Entity
@Table(name = "age_groups")
@Filter(name = OrganizationFilter.NAME)
public class AgeGroup extends OrganizationEntity {

	@Column(nullable = false)
	private String code;

	@Column(nullable = false)
	private String name;

	@Column(name = "min_months", nullable = false)
	private int minMonths;

	@Column(name = "max_months", nullable = false)
	private int maxMonths;

	@Column(name = "max_class_size", nullable = false)
	private int maxClassSize;

	@Column(name = "order_no", nullable = false)
	private int orderNo;

	protected AgeGroup() {
	}

	public void update(String name, int minMonths, int maxMonths, int maxClassSize) {
		this.name = name;
		this.minMonths = minMonths;
		this.maxMonths = maxMonths;
		this.maxClassSize = maxClassSize;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public int getMinMonths() {
		return minMonths;
	}

	public int getMaxMonths() {
		return maxMonths;
	}

	public int getMaxClassSize() {
		return maxClassSize;
	}

	public int getOrderNo() {
		return orderNo;
	}

}
