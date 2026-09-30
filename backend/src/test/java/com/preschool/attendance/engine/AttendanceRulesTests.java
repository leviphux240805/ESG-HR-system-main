package com.preschool.attendance.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.preschool.attendance.engine.AttendanceReconciler.Config;
import com.preschool.attendance.engine.AttendanceReconciler.DayResult;
import com.preschool.attendance.engine.AttendanceReconciler.Punch;

import org.junit.jupiter.api.Test;

/** Ba lỗi của bản cũ đã sửa (có chủ đích lệch bản cũ) và các tham số lấy từ cấu hình cơ sở. */
class AttendanceRulesTests {

	private static final Config LEGACY = Config.legacy(LocalTime.of(7, 30), 15, 3);

	private static final LocalDate THURSDAY = LocalDate.of(2026, 9, 3);

	private static DayResult one(Config config, String checkIn, String checkOut) {
		return AttendanceReconciler.reconcile(config, List.of(new Punch("A", THURSDAY, checkIn, checkOut)), List.of())
			.getFirst();
	}

	@Test
	void machineAbsentBecomesKNotX() {
		// Bản cũ: final_status = check_in ? "X" → ngày máy ghi vắng thành X
		assertThat(AttendanceReconciler.autoStatus(one(LEGACY, "K", "K"))).isEqualTo("K");
	}

	@Test
	void validPunchWithoutDiscrepancyIsFilledWithX() {
		// Bản cũ để trống bảng công dù máy có giờ vào/ra đầy đủ
		assertThat(AttendanceReconciler.autoStatus(one(LEGACY, "07:25", "17:02"))).isEqualTo("X");
		// Sai lệch (thiếu giờ ra, về trưa) và ngày đã chấm tay thì không tự điền
		assertThat(AttendanceReconciler.autoStatus(one(LEGACY, "07:25", null))).isNull();
		assertThat(AttendanceReconciler.autoStatus(one(LEGACY, "07:25", "12:10"))).isNull();
		DayResult marked = AttendanceReconciler.reconcile(LEGACY, List.of(new Punch("A", THURSDAY, "07:25", "17:00")),
				List.of(new AttendanceReconciler.Mark("A", THURSDAY, "P")))
			.getFirst();
		assertThat(AttendanceReconciler.autoStatus(marked)).isNull();
	}

	@Test
	void halfDayLeaveCountsTowardsPaidAndUnpaidTotals() {
		YearMonth month = YearMonth.of(2026, 9);
		MonthTotals totals = MonthTotals.compute(month,
				Map.of(LocalDate.of(2026, 9, 3), "1/2P", LocalDate.of(2026, 9, 4), "1/2K", LocalDate.of(2026, 9, 7), "X",
						LocalDate.of(2026, 9, 8), "P", LocalDate.of(2026, 9, 9), "K", LocalDate.of(2026, 9, 10), "NN"),
				Set.of(), EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.SATURDAY), 2);
		assertThat(totals.totalWork()).isEqualByComparingTo("2.5");
		assertThat(totals.paidLeave()).isEqualByComparingTo("1.5"); // bản cũ: 1
		assertThat(totals.unpaidLeave()).isEqualByComparingTo("1.5"); // bản cũ: 1
		assertThat(totals.lateCount()).isEqualTo(2);
	}

	@Test
	void holidaysCountAsWorkOnWorkingDaysWithOldPrecedence() {
		YearMonth month = YearMonth.of(2026, 9);
		Set<LocalDate> holidays = Set.of(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 2), LocalDate.of(2026, 9, 6));
		// 1/9 chưa chấm → lễ; 2/9 ghi X → X (1 công, không đếm lễ); 6/9 là Chủ nhật (nghỉ tuần) → không tính
		MonthTotals totals = MonthTotals.compute(month, Map.of(LocalDate.of(2026, 9, 2), "X"), holidays,
				EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.SATURDAY), 0);
		assertThat(totals.totalWork()).isEqualByComparingTo("2");
		assertThat(totals.holidayLeave()).isEqualByComparingTo("1");
		assertThat(totals.paidLeave()).isEqualByComparingTo(BigDecimal.ZERO);
	}

	@Test
	void lunchAndHalfDayWeekdaysComeFromSchoolConfig() {
		// Cơ sở nghỉ trưa 11:00–14:00, không làm nửa buổi thứ Bảy
		Config config = new Config(LocalTime.of(7, 0), 10, 2, LocalTime.of(11, 0), LocalTime.of(14, 0),
				EnumSet.noneOf(DayOfWeek.class));
		LocalDate saturday = LocalDate.of(2026, 9, 5);
		DayResult result = AttendanceReconciler
			.reconcile(config, List.of(new Punch("A", saturday, "07:00", "11:30")), List.of())
			.getFirst();
		assertThat(result.discrepancy()).isTrue();
		assertThat(result.suggestedStatus()).isEqualTo("1/2K");
		// Về 15:59 vẫn trong khoảng "chiều sớm" (14:00 + 2h)
		assertThat(one(config, "07:00", "15:59").discrepancy()).isTrue();
		assertThat(one(config, "07:00", "16:01").discrepancy()).isFalse();
	}

}
