package com.preschool.health.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.health.engine.GrowthClassifier.Result;
import com.preschool.health.entity.HealthEnums.BmiStatus;
import com.preschool.health.entity.HealthEnums.GrowthStandard;
import com.preschool.health.entity.HealthEnums.HeightStatus;
import com.preschool.health.entity.HealthEnums.MeasurementSource;
import com.preschool.health.entity.HealthEnums.WeightStatus;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một lần cân đo của trẻ, kèm kết quả xếp kênh WHO tại thời điểm cân đo. */
@Entity
@Table(name = "growth_measurements")
@Filter(name = SchoolFilter.NAME)
public class GrowthMeasurement extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "class_id")
	private UUID classId;

	@Column(name = "measured_on", nullable = false)
	private LocalDate measuredOn;

	@Column(name = "weight_kg", nullable = false)
	private BigDecimal weightKg;

	@Column(name = "height_cm", nullable = false)
	private BigDecimal heightCm;

	@Column(name = "age_days", nullable = false)
	private int ageDays;

	@Column(name = "age_months", nullable = false)
	private BigDecimal ageMonths;

	@Column(nullable = false)
	private BigDecimal bmi;

	@Column(name = "weight_z")
	private BigDecimal weightZ;

	@Column(name = "height_z")
	private BigDecimal heightZ;

	@Column(name = "bmi_z")
	private BigDecimal bmiZ;

	@Enumerated(EnumType.STRING)
	@Column(name = "weight_status")
	private WeightStatus weightStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "height_status")
	private HeightStatus heightStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "bmi_status")
	private BmiStatus bmiStatus;

	@Enumerated(EnumType.STRING)
	private GrowthStandard standard;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private MeasurementSource source;

	private String note;

	@Column(name = "recorded_by")
	private UUID recordedBy;

	protected GrowthMeasurement() {
	}

	public GrowthMeasurement(UUID schoolId, UUID childId, LocalDate measuredOn) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.measuredOn = measuredOn;
	}

	public void record(UUID classId, BigDecimal weightKg, BigDecimal heightCm, MeasurementSource source, String note,
			UUID recordedBy, Result result) {
		this.classId = classId;
		this.weightKg = weightKg;
		this.heightCm = heightCm;
		this.source = source;
		this.note = note;
		this.recordedBy = recordedBy;
		this.ageDays = result.ageDays();
		this.ageMonths = result.ageMonths();
		this.bmi = result.bmi();
		this.weightZ = result.weightZ();
		this.heightZ = result.heightZ();
		this.bmiZ = result.bmiZ();
		this.weightStatus = result.weightStatus();
		this.heightStatus = result.heightStatus();
		this.bmiStatus = result.bmiStatus();
		this.standard = result.standard();
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

	public LocalDate getMeasuredOn() {
		return measuredOn;
	}

	public BigDecimal getWeightKg() {
		return weightKg;
	}

	public BigDecimal getHeightCm() {
		return heightCm;
	}

	public int getAgeDays() {
		return ageDays;
	}

	public BigDecimal getAgeMonths() {
		return ageMonths;
	}

	public BigDecimal getBmi() {
		return bmi;
	}

	public BigDecimal getWeightZ() {
		return weightZ;
	}

	public BigDecimal getHeightZ() {
		return heightZ;
	}

	public BigDecimal getBmiZ() {
		return bmiZ;
	}

	public WeightStatus getWeightStatus() {
		return weightStatus;
	}

	public HeightStatus getHeightStatus() {
		return heightStatus;
	}

	public BmiStatus getBmiStatus() {
		return bmiStatus;
	}

	public GrowthStandard getStandard() {
		return standard;
	}

	public MeasurementSource getSource() {
		return source;
	}

	public String getNote() {
		return note;
	}

	public UUID getRecordedBy() {
		return recordedBy;
	}

}
