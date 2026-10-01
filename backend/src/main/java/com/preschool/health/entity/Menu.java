package com.preschool.health.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.health.entity.HealthEnums.MenuStatus;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Thực đơn một tuần (bắt đầu thứ Hai) của cơ sở; khối rỗng = áp dụng mọi khối. */
@Entity
@Table(name = "menus")
@Filter(name = SchoolFilter.NAME)
public class Menu extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "age_group_id")
	private UUID ageGroupId;

	@Column(name = "week_start", nullable = false)
	private LocalDate weekStart;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private MenuStatus status = MenuStatus.DRAFT;

	private String note;

	@Column(name = "published_at")
	private Instant publishedAt;

	protected Menu() {
	}

	public Menu(UUID schoolId, UUID ageGroupId, LocalDate weekStart) {
		this.schoolId = schoolId;
		this.ageGroupId = ageGroupId;
		this.weekStart = weekStart;
	}

	public void setNote(String note) {
		this.note = note;
	}

	public void publish(Instant at) {
		this.status = MenuStatus.PUBLISHED;
		this.publishedAt = at;
	}

	public void unpublish() {
		this.status = MenuStatus.DRAFT;
		this.publishedAt = null;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getAgeGroupId() {
		return ageGroupId;
	}

	public LocalDate getWeekStart() {
		return weekStart;
	}

	public MenuStatus getStatus() {
		return status;
	}

	public String getNote() {
		return note;
	}

	public Instant getPublishedAt() {
		return publishedAt;
	}

}
