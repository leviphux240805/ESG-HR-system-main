package com.preschool.school.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Ngày lễ; {@code schoolId} rỗng = áp dụng toàn chuỗi. */
@Entity
@Table(name = "holidays")
@Filter(name = SchoolFilter.NAME)
public class Holiday extends BaseEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "holiday_date", nullable = false)
	private LocalDate holidayDate;

	@Column(nullable = false)
	private String name;

	@Column(name = "is_custom", nullable = false)
	private boolean custom;

	protected Holiday() {
	}

	public Holiday(UUID schoolId, LocalDate holidayDate, String name, boolean custom) {
		this.schoolId = schoolId;
		this.holidayDate = holidayDate;
		this.name = name;
		this.custom = custom;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getHolidayDate() {
		return holidayDate;
	}

	public String getName() {
		return name;
	}

	public boolean isCustom() {
		return custom;
	}

}
