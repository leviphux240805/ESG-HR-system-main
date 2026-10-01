package com.preschool.health.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.health.entity.HealthEnums.HealthLogType;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một ghi chép sổ theo dõi sức khỏe hằng ngày (sốt, dặn thuốc, sự cố) và việc đã báo phụ huynh. */
@Entity
@Table(name = "health_logs")
@Filter(name = SchoolFilter.NAME)
public class HealthLog extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "class_id")
	private UUID classId;

	@Column(name = "log_date", nullable = false)
	private LocalDate logDate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private HealthLogType type;

	@Column(nullable = false)
	private String content;

	@Column(name = "temperature_c")
	private BigDecimal temperatureC;

	@Column(name = "parent_notified_at")
	private Instant parentNotifiedAt;

	@Column(name = "parent_notified_by")
	private UUID parentNotifiedBy;

	@Column(name = "recorded_by")
	private UUID recordedBy;

	protected HealthLog() {
	}

	public HealthLog(UUID schoolId, UUID childId, UUID classId, UUID recordedBy) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.classId = classId;
		this.recordedBy = recordedBy;
	}

	public void update(LocalDate logDate, HealthLogType type, String content, BigDecimal temperatureC) {
		this.logDate = logDate;
		this.type = type;
		this.content = content;
		this.temperatureC = temperatureC;
	}

	public void markParentNotified(Instant at, UUID by) {
		this.parentNotifiedAt = at;
		this.parentNotifiedBy = by;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getChildId() {
		return childId;
	}

	public UUID getClassId() {
		return classId;
	}

	public LocalDate getLogDate() {
		return logDate;
	}

	public HealthLogType getType() {
		return type;
	}

	public String getContent() {
		return content;
	}

	public BigDecimal getTemperatureC() {
		return temperatureC;
	}

	public Instant getParentNotifiedAt() {
		return parentNotifiedAt;
	}

	public UUID getParentNotifiedBy() {
		return parentNotifiedBy;
	}

	public UUID getRecordedBy() {
		return recordedBy;
	}

}
