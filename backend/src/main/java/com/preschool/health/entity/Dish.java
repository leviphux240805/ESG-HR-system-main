package com.preschool.health.entity;

import java.math.BigDecimal;
import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Món ăn: school_id rỗng = dùng chung trong tổ chức. Thành phần lưu JSON [{name, grams}], dinh dưỡng cho một suất. */
@Entity
@Table(name = "dishes")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class Dish extends OrganizationEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(nullable = false)
	private String name;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private String ingredients = "[]";

	private BigDecimal kcal;

	@Column(name = "protein_g")
	private BigDecimal proteinG;

	@Column(name = "fat_g")
	private BigDecimal fatG;

	@Column(name = "carb_g")
	private BigDecimal carbG;

	@Column(nullable = false)
	private boolean active = true;

	protected Dish() {
	}

	public Dish(UUID schoolId) {
		this.schoolId = schoolId;
	}

	public void update(String name, String ingredients, BigDecimal kcal, BigDecimal proteinG, BigDecimal fatG,
			BigDecimal carbG, boolean active) {
		this.name = name;
		this.ingredients = ingredients;
		this.kcal = kcal;
		this.proteinG = proteinG;
		this.fatG = fatG;
		this.carbG = carbG;
		this.active = active;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public String getName() {
		return name;
	}

	public String getIngredients() {
		return ingredients;
	}

	public BigDecimal getKcal() {
		return kcal;
	}

	public BigDecimal getProteinG() {
		return proteinG;
	}

	public BigDecimal getFatG() {
		return fatG;
	}

	public BigDecimal getCarbG() {
		return carbG;
	}

	public boolean isActive() {
		return active;
	}

}
