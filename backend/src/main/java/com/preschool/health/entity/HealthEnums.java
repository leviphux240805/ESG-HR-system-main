package com.preschool.health.entity;

/** Kiểu liệt kê của module Thực đơn và Sức khỏe (khớp CHECK trong migration V11). */
public final class HealthEnums {

	private HealthEnums() {
	}

	/** Bữa sáng · trưa · chiều · phụ. */
	public enum Meal {
		BREAKFAST, LUNCH, AFTERNOON, SNACK
	}

	public enum MenuStatus {
		DRAFT, PUBLISHED
	}

	/** Cân nặng/tuổi · chiều cao/tuổi · BMI/tuổi. */
	public enum Indicator {
		WFA, HFA, BFA
	}

	public enum AgeUnit {
		DAY, MONTH
	}

	public enum GrowthStandard {
		WHO_2006, WHO_2007
	}

	/** Giáo viên nhập theo lớp · khám định kỳ · phụ huynh báo. */
	public enum MeasurementSource {
		CLASS, CHECKUP, PARENT
	}

	public enum WeightStatus {
		SEVERE_UNDERWEIGHT, UNDERWEIGHT, NORMAL, ABOVE_NORMAL
	}

	public enum HeightStatus {
		SEVERE_STUNTED, STUNTED, NORMAL, TALL
	}

	public enum BmiStatus {
		SEVERE_WASTED, WASTED, NORMAL, OVERWEIGHT_RISK, OVERWEIGHT, OBESE
	}

	/** Sốt · dặn thuốc · sự cố nhỏ · khác. */
	public enum HealthLogType {
		FEVER, MEDICINE, INCIDENT, OTHER
	}

}
