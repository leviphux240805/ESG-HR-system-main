package com.preschool.health.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.health.entity.HealthEnums.AgeUnit;
import com.preschool.health.entity.HealthEnums.BmiStatus;
import com.preschool.health.entity.HealthEnums.GrowthStandard;
import com.preschool.health.entity.HealthEnums.HeightStatus;
import com.preschool.health.entity.HealthEnums.Indicator;
import com.preschool.health.entity.HealthEnums.WeightStatus;

/**
 * Xếp kênh tăng trưởng theo chuẩn WHO, thuần Java (bảng LMS truyền vào). Cách tính theo đúng gói R chính thức của WHO
 * ({@code anthro} cho 0–5 tuổi, {@code anthroplus} cho 5–19 tuổi):
 * <ul>
 * <li>Tuổi ≤ 1826 ngày: WHO 2006, tra bảng theo số ngày tuổi.</li>
 * <li>Tuổi > 1826 ngày: WHO 2007, tháng tuổi = ngày / 30,4375, nội suy tuyến tính L, M, S giữa hai tháng.</li>
 * <li>Z = ((X/M)^L − 1)/(L·S); cân nặng và BMI dùng Z hiệu chỉnh ngoài ±3 SD; làm tròn 2 chữ số.</li>
 * </ul>
 * TODO(assumption): chiều dài nằm dưới 731 ngày, chiều cao đứng từ 731 ngày (không cộng/trừ 0,7 cm); ngưỡng kênh cố
 * định theo WHO, BMI từ 61 tháng theo ngưỡng WHO 2007.
 */
public final class GrowthClassifier {

	public static final int WHO_2006_MAX_DAYS = 1826;

	public static final double DAYS_PER_MONTH = 30.4375;

	public record Lms(double l, double m, double s) {
	}

	public record Result(int ageDays, BigDecimal ageMonths, BigDecimal bmi, BigDecimal weightZ, BigDecimal heightZ,
			BigDecimal bmiZ, WeightStatus weightStatus, HeightStatus heightStatus, BmiStatus bmiStatus,
			GrowthStandard standard) {
	}

	/** Bảng LMS theo (chỉ số, giới, đơn vị tuổi, tuổi). */
	public static final class Tables {

		private record Key(Indicator indicator, Gender gender, AgeUnit unit, int age) {
		}

		private final Map<Key, Lms> rows = new HashMap<>();

		public Tables put(Indicator indicator, Gender gender, AgeUnit unit, int age, Lms lms) {
			rows.put(new Key(indicator, gender, unit, age), lms);
			return this;
		}

		Lms get(Indicator indicator, Gender gender, AgeUnit unit, int age) {
			return rows.get(new Key(indicator, gender, unit, age));
		}

		public int size() {
			return rows.size();
		}

	}

	private final Tables tables;

	public GrowthClassifier(Tables tables) {
		this.tables = tables;
	}

	public Result classify(Gender gender, LocalDate dob, LocalDate measuredOn, BigDecimal weightKg,
			BigDecimal heightCm) {
		int ageDays = (int) ChronoUnit.DAYS.between(dob, measuredOn);
		if (ageDays < 0) {
			throw new IllegalArgumentException("Ngày cân đo trước ngày sinh");
		}
		double weight = weightKg.doubleValue();
		double height = heightCm.doubleValue();
		double bmi = bmi(weight, height);
		double months = ageDays / DAYS_PER_MONTH;
		Double wz;
		Double hz;
		Double bz;
		GrowthStandard standard;
		if (ageDays <= WHO_2006_MAX_DAYS) {
			standard = GrowthStandard.WHO_2006;
			wz = zDay(Indicator.WFA, gender, ageDays, weight, true);
			hz = zDay(Indicator.HFA, gender, ageDays, height, false);
			bz = zDay(Indicator.BFA, gender, ageDays, bmi, true);
		}
		else {
			standard = GrowthStandard.WHO_2007;
			wz = zMonth(Indicator.WFA, gender, months, weight, true);
			hz = zMonth(Indicator.HFA, gender, months, height, false);
			bz = zMonth(Indicator.BFA, gender, months, bmi, true);
		}
		if (wz == null && hz == null && bz == null) {
			standard = null;
		}
		return new Result(ageDays, scale(months, 2), scale(bmi, 2), toDecimal(wz), toDecimal(hz), toDecimal(bz),
				weightStatus(wz), heightStatus(hz), bmiStatus(bz, standard), standard);
	}

	/** Z theo WHO 2007 với tháng tuổi cho sẵn (dùng cho kiểm thử đối chiếu anthroplus). */
	Double zMonth(Indicator indicator, Gender gender, double ageMonths, double value, boolean adjusted) {
		Lms lms = monthLms(indicator, gender, ageMonths);
		return lms == null ? null : round2(z(lms, value, adjusted));
	}

	/** L, M, S tại tuổi (ngày) theo đúng chuẩn dùng để xếp kênh; null nếu ngoài bảng. */
	public Lms lmsAt(Indicator indicator, Gender gender, int ageDays) {
		return ageDays <= WHO_2006_MAX_DAYS ? tables.get(indicator, gender, AgeUnit.DAY, ageDays)
				: monthLms(indicator, gender, ageDays / DAYS_PER_MONTH);
	}

	private Lms monthLms(Indicator indicator, Gender gender, double ageMonths) {
		int low = (int) Math.floor(ageMonths);
		double diff = ageMonths - low;
		Lms lo = tables.get(indicator, gender, AgeUnit.MONTH, low);
		if (lo == null || diff == 0) {
			return lo;
		}
		Lms up = tables.get(indicator, gender, AgeUnit.MONTH, low + 1);
		if (up == null) {
			return null;
		}
		return new Lms(lo.l() + diff * (up.l() - lo.l()), lo.m() + diff * (up.m() - lo.m()),
				lo.s() + diff * (up.s() - lo.s()));
	}

	Double zDay(Indicator indicator, Gender gender, int ageDays, double value, boolean adjusted) {
		Lms lms = tables.get(indicator, gender, AgeUnit.DAY, ageDays);
		return lms == null ? null : round2(z(lms, value, adjusted));
	}

	static double bmi(double weightKg, double heightCm) {
		double h = heightCm / 100;
		return weightKg / (h * h);
	}

	static double z(Lms p, double y, boolean adjusted) {
		double z = (Math.pow(y / p.m(), p.l()) - 1) / (p.s() * p.l());
		if (!adjusted) {
			return z;
		}
		if (z > 3) {
			double sd3 = sd(p, 3);
			return 3 + (y - sd3) / (sd3 - sd(p, 2));
		}
		if (z < -3) {
			double sd3 = sd(p, -3);
			return -3 + (y - sd3) / (sd(p, -2) - sd3);
		}
		return z;
	}

	/** Giá trị tại k SD: M·(1 + L·S·k)^(1/L). */
	public static double sd(Lms p, double k) {
		return p.m() * Math.pow(1 + p.l() * p.s() * k, 1 / p.l());
	}

	static WeightStatus weightStatus(Double z) {
		if (z == null) {
			return null;
		}
		if (z < -3) {
			return WeightStatus.SEVERE_UNDERWEIGHT;
		}
		if (z < -2) {
			return WeightStatus.UNDERWEIGHT;
		}
		return z > 2 ? WeightStatus.ABOVE_NORMAL : WeightStatus.NORMAL;
	}

	static HeightStatus heightStatus(Double z) {
		if (z == null) {
			return null;
		}
		if (z < -3) {
			return HeightStatus.SEVERE_STUNTED;
		}
		if (z < -2) {
			return HeightStatus.STUNTED;
		}
		return z > 3 ? HeightStatus.TALL : HeightStatus.NORMAL;
	}

	static BmiStatus bmiStatus(Double z, GrowthStandard standard) {
		if (z == null) {
			return null;
		}
		if (z < -3) {
			return BmiStatus.SEVERE_WASTED;
		}
		if (z < -2) {
			return BmiStatus.WASTED;
		}
		if (standard == GrowthStandard.WHO_2007) {
			if (z > 2) {
				return BmiStatus.OBESE;
			}
			return z > 1 ? BmiStatus.OVERWEIGHT : BmiStatus.NORMAL;
		}
		if (z > 3) {
			return BmiStatus.OBESE;
		}
		if (z > 2) {
			return BmiStatus.OVERWEIGHT;
		}
		return z > 1 ? BmiStatus.OVERWEIGHT_RISK : BmiStatus.NORMAL;
	}

	private static Double round2(double v) {
		return Double.isFinite(v) ? BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_EVEN).doubleValue() : null;
	}

	private static BigDecimal scale(double v, int digits) {
		return BigDecimal.valueOf(v).setScale(digits, RoundingMode.HALF_UP);
	}

	private static BigDecimal toDecimal(Double v) {
		return v == null ? null : BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_EVEN);
	}

}
