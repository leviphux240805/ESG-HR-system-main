package com.preschool.health.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.health.engine.GrowthClassifier.Lms;
import com.preschool.health.engine.GrowthClassifier.Result;
import com.preschool.health.engine.GrowthClassifier.Tables;
import com.preschool.health.entity.HealthEnums.AgeUnit;
import com.preschool.health.entity.HealthEnums.BmiStatus;
import com.preschool.health.entity.HealthEnums.GrowthStandard;
import com.preschool.health.entity.HealthEnums.HeightStatus;
import com.preschool.health.entity.HealthEnums.Indicator;
import com.preschool.health.entity.HealthEnums.WeightStatus;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Đối chiếu bộ xếp kênh với bộ mẫu WHO: bảng LMS đọc thẳng từ migration V12; WHO 2007 so với z do gói anthroplus của
 * WHO tính sẵn trên bộ khảo sát mẫu; WHO 2006 so với các điểm trong test của gói anthro và các điểm biên ±2, ±3 SD.
 */
class GrowthClassifierTests {

	private static final Pattern ROW = Pattern
		.compile("\\('(\\w+)','(\\w+)','(\\w+)',(\\d+),([-\\d.]+),([-\\d.]+),([-\\d.]+),'\\w+'\\)");

	private static Tables tables;

	private static GrowthClassifier classifier;

	@BeforeAll
	static void loadTables() throws IOException {
		tables = new Tables();
		try (InputStream in = GrowthClassifierTests.class
			.getResourceAsStream("/db/migration/V12__chuan_tang_truong_who.sql")) {
			Matcher m = ROW.matcher(new String(in.readAllBytes(), StandardCharsets.UTF_8));
			while (m.find()) {
				tables.put(Indicator.valueOf(m.group(1)), Gender.valueOf(m.group(2)), AgeUnit.valueOf(m.group(3)),
						Integer.parseInt(m.group(4)), new Lms(Double.parseDouble(m.group(5)),
								Double.parseDouble(m.group(6)), Double.parseDouble(m.group(7))));
			}
		}
		classifier = new GrowthClassifier(tables);
	}

	@Test
	void v12HasFullTables() {
		assertThat(tables.size()).isEqualTo(3 * 2 * 1827 + 3 * 2 * 37);
	}

	@Test
	void who2007MatchesAnthroplusSurvey() throws IOException {
		List<String> mismatches = new ArrayList<>();
		int checked = 0;
		try (BufferedReader r = new BufferedReader(new InputStreamReader(
				GrowthClassifierTests.class.getResourceAsStream("/health/who2007-survey.csv"), StandardCharsets.UTF_8))) {
			r.readLine();
			for (String line; (line = r.readLine()) != null;) {
				String[] c = line.split(",", -1);
				if (c[2].isEmpty() || c[3].isEmpty()) {
					continue;
				}
				Gender g = "1".equals(c[0]) ? Gender.MALE : Gender.FEMALE;
				double months = Double.parseDouble(c[1]);
				double w = Double.parseDouble(c[2]);
				double h = Double.parseDouble(c[3]);
				checked++;
				compare(mismatches, line, "zwfa", c[4], classifier.zMonth(Indicator.WFA, g, months, w, true));
				compare(mismatches, line, "zhfa", c[5], classifier.zMonth(Indicator.HFA, g, months, h, false));
				compare(mismatches, line, "zbfa", c[6],
						classifier.zMonth(Indicator.BFA, g, months, GrowthClassifier.bmi(w, h), true));
			}
		}
		assertThat(checked).isGreaterThan(100);
		assertThat(mismatches).isEmpty();
	}

	private static void compare(List<String> out, String line, String name, String expected, Double actual) {
		if (expected.isEmpty()) {
			return;
		}
		if (actual == null || Math.abs(actual - Double.parseDouble(expected)) > 0.0001) {
			out.add(line + " → " + name + "=" + actual);
		}
	}

	@Test
	void who2006MatchesAnthroTestPoints() {
		assertThat(classifier.zDay(Indicator.WFA, Gender.FEMALE, 1522, 17, true)).isEqualTo(0.24);
		double expected = BigDecimal.valueOf((50 / 56.4833 - 1) / 0.03492)
			.setScale(2, java.math.RoundingMode.HALF_EVEN)
			.doubleValue();
		assertThat(classifier.zDay(Indicator.HFA, Gender.MALE, 44, 50, false)).isEqualTo(expected);
	}

	@Test
	void adjustedZBeyondThreeSd() {
		Lms p = tables.get(Indicator.WFA, Gender.MALE, AgeUnit.DAY, 1000);
		double sd3 = sd(p, 3);
		double sd2 = sd(p, 2);
		double y = sd3 + (sd3 - sd2) / 2;
		assertThat(GrowthClassifier.z(p, y, true)).isCloseTo(3.5, org.assertj.core.data.Offset.offset(1e-9));
		assertThat(GrowthClassifier.z(p, y, false)).isNotCloseTo(3.5, org.assertj.core.data.Offset.offset(0.01));
	}

	@Test
	void channelsAtBoundaries() {
		LocalDate dob = LocalDate.of(2023, 1, 1);
		LocalDate on = dob.plusDays(1000);
		Lms w = tables.get(Indicator.WFA, Gender.FEMALE, AgeUnit.DAY, 1000);
		Lms h = tables.get(Indicator.HFA, Gender.FEMALE, AgeUnit.DAY, 1000);
		double medianH = h.m();

		assertThat(weight(dob, on, sd(w, -2))).isEqualTo(WeightStatus.NORMAL);
		assertThat(weight(dob, on, sd(w, -2) - 0.1)).isEqualTo(WeightStatus.UNDERWEIGHT);
		assertThat(weight(dob, on, sd(w, -3) - 0.1)).isEqualTo(WeightStatus.SEVERE_UNDERWEIGHT);
		assertThat(weight(dob, on, sd(w, 2))).isEqualTo(WeightStatus.NORMAL);
		assertThat(weight(dob, on, sd(w, 2) + 0.1)).isEqualTo(WeightStatus.ABOVE_NORMAL);

		assertThat(height(dob, on, sd(h, -2))).isEqualTo(HeightStatus.NORMAL);
		assertThat(height(dob, on, sd(h, -2) - 0.3)).isEqualTo(HeightStatus.STUNTED);
		assertThat(height(dob, on, sd(h, -3) - 0.3)).isEqualTo(HeightStatus.SEVERE_STUNTED);
		assertThat(height(dob, on, sd(h, 3))).isEqualTo(HeightStatus.NORMAL);
		assertThat(height(dob, on, sd(h, 3) + 0.3)).isEqualTo(HeightStatus.TALL);

		Lms b = tables.get(Indicator.BFA, Gender.FEMALE, AgeUnit.DAY, 1000);
		assertThat(bmi(dob, on, medianH, sd(b, 1) * 1.01)).isEqualTo(BmiStatus.OVERWEIGHT_RISK);
		assertThat(bmi(dob, on, medianH, sd(b, 2) * 1.01)).isEqualTo(BmiStatus.OVERWEIGHT);
		assertThat(bmi(dob, on, medianH, sd(b, 3) * 1.01)).isEqualTo(BmiStatus.OBESE);
		assertThat(bmi(dob, on, medianH, sd(b, -2) * 0.99)).isEqualTo(BmiStatus.WASTED);
		assertThat(bmi(dob, on, medianH, sd(b, -3) * 0.99)).isEqualTo(BmiStatus.SEVERE_WASTED);
		assertThat(bmi(dob, on, medianH, b.m())).isEqualTo(BmiStatus.NORMAL);
	}

	@Test
	void who2007BmiCutoffsAfterFiveYears() {
		LocalDate dob = LocalDate.of(2019, 1, 1);
		LocalDate on = dob.plusDays(2192);
		double months = 2192 / GrowthClassifier.DAYS_PER_MONTH;
		Lms b = interpolate(Indicator.BFA, Gender.MALE, months);
		double height = 115;
		Result over = classifier.classify(Gender.MALE, dob, on, weightFor(sd(b, 1.5), height), BigDecimal.valueOf(height));
		assertThat(over.standard()).isEqualTo(GrowthStandard.WHO_2007);
		assertThat(over.bmiStatus()).isEqualTo(BmiStatus.OVERWEIGHT);
		Result obese = classifier.classify(Gender.MALE, dob, on, weightFor(sd(b, 2.5), height), BigDecimal.valueOf(height));
		assertThat(obese.bmiStatus()).isEqualTo(BmiStatus.OBESE);
	}

	@Test
	void switchesStandardAfter1826Days() {
		LocalDate dob = LocalDate.of(2020, 1, 1);
		Result last2006 = classifier.classify(Gender.FEMALE, dob, dob.plusDays(1826), BigDecimal.valueOf(18),
				BigDecimal.valueOf(109));
		Result first2007 = classifier.classify(Gender.FEMALE, dob, dob.plusDays(1827), BigDecimal.valueOf(18),
				BigDecimal.valueOf(109));
		assertThat(last2006.standard()).isEqualTo(GrowthStandard.WHO_2006);
		assertThat(first2007.standard()).isEqualTo(GrowthStandard.WHO_2007);
		assertThat(first2007.weightZ().doubleValue()).isCloseTo(last2006.weightZ().doubleValue(),
				org.assertj.core.data.Offset.offset(0.1));
	}

	@Test
	void outsideTablesHasNoChannel() {
		LocalDate dob = LocalDate.of(2010, 1, 1);
		Result r = classifier.classify(Gender.MALE, dob, LocalDate.of(2026, 1, 1), BigDecimal.valueOf(50),
				BigDecimal.valueOf(165));
		assertThat(r.standard()).isNull();
		assertThat(r.weightStatus()).isNull();
		assertThat(r.bmi()).isEqualByComparingTo("18.37");
	}

	private static WeightStatus weight(LocalDate dob, LocalDate on, double kg) {
		return classifier.classify(Gender.FEMALE, dob, on, BigDecimal.valueOf(kg), BigDecimal.valueOf(90)).weightStatus();
	}

	private static HeightStatus height(LocalDate dob, LocalDate on, double cm) {
		return classifier.classify(Gender.FEMALE, dob, on, BigDecimal.valueOf(12), BigDecimal.valueOf(cm)).heightStatus();
	}

	private static BmiStatus bmi(LocalDate dob, LocalDate on, double heightCm, double bmi) {
		return classifier.classify(Gender.FEMALE, dob, on, weightFor(bmi, heightCm), BigDecimal.valueOf(heightCm))
			.bmiStatus();
	}

	private static BigDecimal weightFor(double bmi, double heightCm) {
		double h = heightCm / 100;
		return BigDecimal.valueOf(bmi * h * h);
	}

	private static Lms interpolate(Indicator indicator, Gender gender, double months) {
		int low = (int) Math.floor(months);
		double d = months - low;
		Lms a = tables.get(indicator, gender, AgeUnit.MONTH, low);
		Lms b = tables.get(indicator, gender, AgeUnit.MONTH, low + 1);
		return new Lms(a.l() + d * (b.l() - a.l()), a.m() + d * (b.m() - a.m()), a.s() + d * (b.s() - a.s()));
	}

	private static double sd(Lms p, double k) {
		return p.m() * Math.pow(1 + p.l() * p.s() * k, 1 / p.l());
	}

}
