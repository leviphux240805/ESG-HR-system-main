package com.preschool.health.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Kết quả khám sức khỏe định kỳ của trẻ (kèm file biên bản nếu có). */
@Entity
@Table(name = "health_checkups")
@Filter(name = SchoolFilter.NAME)
public class HealthCheckup extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "checkup_date", nullable = false)
	private LocalDate checkupDate;

	private String provider;

	@Column(nullable = false)
	private String summary;

	@Column(name = "file_id")
	private UUID fileId;

	protected HealthCheckup() {
	}

	public HealthCheckup(UUID schoolId, UUID childId) {
		this.schoolId = schoolId;
		this.childId = childId;
	}

	public void update(LocalDate checkupDate, String provider, String summary, UUID fileId) {
		this.checkupDate = checkupDate;
		this.provider = provider;
		this.summary = summary;
		this.fileId = fileId;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getChildId() {
		return childId;
	}

	public LocalDate getCheckupDate() {
		return checkupDate;
	}

	public String getProvider() {
		return provider;
	}

	public String getSummary() {
		return summary;
	}

	public UUID getFileId() {
		return fileId;
	}

}
