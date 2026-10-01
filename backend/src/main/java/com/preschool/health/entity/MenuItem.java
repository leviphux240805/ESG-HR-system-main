package com.preschool.health.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.health.entity.HealthEnums.Meal;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một món trong một bữa của một ngày thuộc thực đơn tuần. */
@Entity
@Table(name = "menu_items")
@Filter(name = SchoolFilter.NAME)
public class MenuItem extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "menu_id", nullable = false)
	private UUID menuId;

	@Column(name = "menu_date", nullable = false)
	private LocalDate menuDate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Meal meal;

	@Column(name = "dish_id", nullable = false)
	private UUID dishId;

	@Column(name = "order_no", nullable = false)
	private int orderNo;

	private String note;

	protected MenuItem() {
	}

	public MenuItem(UUID schoolId, UUID menuId, LocalDate menuDate, Meal meal, UUID dishId, int orderNo, String note) {
		this.schoolId = schoolId;
		this.menuId = menuId;
		this.menuDate = menuDate;
		this.meal = meal;
		this.dishId = dishId;
		this.orderNo = orderNo;
		this.note = note;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getMenuId() {
		return menuId;
	}

	public LocalDate getMenuDate() {
		return menuDate;
	}

	public Meal getMeal() {
		return meal;
	}

	public UUID getDishId() {
		return dishId;
	}

	public int getOrderNo() {
		return orderNo;
	}

	public String getNote() {
		return note;
	}

}
