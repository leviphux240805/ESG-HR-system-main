package com.preschool.health.entity;

import java.math.BigDecimal;

import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.common.jpa.BaseEntity;
import com.preschool.health.entity.HealthEnums.AgeUnit;
import com.preschool.health.entity.HealthEnums.GrowthStandard;
import com.preschool.health.entity.HealthEnums.Indicator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một dòng bảng LMS chuẩn tăng trưởng WHO (chỉ đọc, nạp ở migration V12). */
@Entity
@Table(name = "who_growth_standards")
public class WhoGrowthStandard extends BaseEntity {

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Indicator indicator;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Gender gender;

	@Enumerated(EnumType.STRING)
	@Column(name = "age_unit", nullable = false)
	private AgeUnit ageUnit;

	@Column(nullable = false)
	private int age;

	@Column(nullable = false)
	private BigDecimal l;

	@Column(nullable = false)
	private BigDecimal m;

	@Column(nullable = false)
	private BigDecimal s;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private GrowthStandard source;

	protected WhoGrowthStandard() {
	}

	public Indicator getIndicator() {
		return indicator;
	}

	public Gender getGender() {
		return gender;
	}

	public AgeUnit getAgeUnit() {
		return ageUnit;
	}

	public int getAge() {
		return age;
	}

	public BigDecimal getL() {
		return l;
	}

	public BigDecimal getM() {
		return m;
	}

	public BigDecimal getS() {
		return s;
	}

	public GrowthStandard getSource() {
		return source;
	}

}
