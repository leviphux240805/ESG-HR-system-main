package com.preschool.attendance.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.attendance.engine.AttendanceReconciler.Config;
import com.preschool.attendance.engine.AttendanceReconciler.DayResult;
import com.preschool.attendance.engine.AttendanceReconciler.Mark;
import com.preschool.attendance.engine.AttendanceReconciler.Punch;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import tools.jackson.databind.json.JsonMapper;

/**
 * Test đối chiếu bắt buộc: bộ đối soát Java cho đúng kết quả bản TS cũ trên cùng dữ liệu. File JSON sinh bởi
 * {@code frontend/src/lib/legacy/attendanceGolden.test.ts} (file Excel mẫu → parser cũ → đối soát cũ); không sửa tay.
 */
class AttendanceReconcilerParityTests {

	record FixtureConfig(String officialStart, int graceMinutes, int maxLateAllowed) {
	}

	record FixturePunch(String code, LocalDate date, String checkIn, String checkOut) {
	}

	record FixtureMark(String code, LocalDate date, String status) {
	}

	record Expected(String code, LocalDate date, int lateMinutes, boolean countedLate, boolean discrepancy,
			String reason, String suggested) {
	}

	record Fixture(String description, FixtureConfig config, List<FixturePunch> punches, List<FixtureMark> manual,
			List<Expected> expected) {
	}

	private static Fixture load(String name) throws IOException {
		try (InputStream in = AttendanceReconcilerParityTests.class.getResourceAsStream("/attendance/" + name)) {
			assertThat(in).as("thiếu file %s (chạy GEN_GOLDEN=1 ở frontend)", name).isNotNull();
			return JsonMapper.builder().build().readValue(in, Fixture.class);
		}
	}

	@ParameterizedTest
	@ValueSource(strings = { "sample-2026-09.json", "edge-cases.json" })
	void matchesLegacyTypeScriptResults(String file) throws IOException {
		Fixture fixture = load(file);
		Config config = Config.legacy(LocalTime.parse(fixture.config().officialStart()),
				fixture.config().graceMinutes(), fixture.config().maxLateAllowed());
		List<Punch> punches = fixture.punches().stream()
			.map(p -> new Punch(p.code(), p.date(), p.checkIn(), p.checkOut()))
			.toList();
		List<Mark> marks = fixture.manual().stream().map(m -> new Mark(m.code(), m.date(), m.status())).toList();

		List<DayResult> actual = AttendanceReconciler.reconcile(config, punches, marks);

		assertThat(actual).hasSameSizeAs(fixture.expected());
		Map<String, DayResult> byKey = actual.stream()
			.collect(Collectors.toMap(r -> r.key() + "|" + r.date(), Function.identity()));
		for (Expected e : fixture.expected()) {
			DayResult r = byKey.get(e.code() + "|" + e.date());
			assertThat(r).as("%s %s", e.code(), e.date()).isNotNull();
			assertThat(new Expected(r.key(), r.date(), r.lateMinutes(), r.countedLate(), r.discrepancy(), r.reason(),
					r.suggestedStatus()))
				.as("%s %s", e.code(), e.date())
				.isEqualTo(e);
		}
	}

}
