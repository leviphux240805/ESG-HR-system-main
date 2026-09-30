package com.preschool.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.UUID;

import com.preschool.IntegrationTest;
import com.preschool.TestData;
import com.preschool.attendance.entity.AttendanceConfig;
import com.preschool.attendance.entity.StaffAttendanceDay;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Ràng buộc schema chấm công (V5). */
@IntegrationTest
class AttendanceSchemaTests {

	@Autowired
	TestData data;

	@Autowired
	EntityManager em;

	@Autowired
	TransactionTemplate tx;

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void configRoundTripsWeekdaysAndRejectsInvalidRanges() {
		School school = data.school();
		UUID id = tx.execute(s -> {
			AttendanceConfig config = new AttendanceConfig(school.getId(), LocalDate.of(2026, 9, 1), LocalTime.of(7, 30),
					LocalTime.of(17, 0), LocalTime.of(11, 30), LocalTime.of(13, 0), 15, 3,
					EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.SATURDAY), EnumSet.of(DayOfWeek.SATURDAY),
					new BigDecimal("12.0"));
			em.persist(config);
			return config.getId();
		});
		AttendanceConfig loaded = em.find(AttendanceConfig.class, id);
		assertThat(loaded.getWorkingWeekdays()).hasSize(6).doesNotContain(DayOfWeek.SUNDAY);
		assertThat(loaded.getHalfDayWeekdays()).containsExactly(DayOfWeek.SATURDAY);
		// Giờ trong ngày không bị lệch theo múi giờ JDBC
		assertThat(jdbc.queryForObject("SELECT shift_start::text FROM attendance_configs WHERE id = ?", String.class, id))
			.isEqualTo("07:30:00");
		assertThat(loaded.getLunchEnd()).isEqualTo(LocalTime.of(13, 0));

		// Ngày nửa buổi phải nằm trong ngày làm việc
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO attendance_configs (school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
				  late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days)
				VALUES (?, '2026-10-01', '07:30', '17:00', '11:30', '13:00', 15, 3, '{1,2,3,4,5}', '{6}', 12)""",
				school.getId())).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void dayStatusMustBeKnownCodeAndUniquePerStaffDay() {
		School school = data.school();
		Staff staff = data.staff(school, Position.TEACHER);
		tx.executeWithoutResult(s -> {
			StaffAttendanceDay day = new StaffAttendanceDay(school.getId(), staff.getId(), LocalDate.of(2026, 9, 3));
			day.setStatus("1/2P", StaffAttendanceDay.Source.MANUAL, null);
			em.persist(day);
		});
		assertThatThrownBy(() -> jdbc.update(
				"INSERT INTO staff_attendance_days (school_id, staff_id, work_date, status_code) VALUES (?, ?, ?, 'Z')",
				school.getId(), staff.getId(), LocalDate.of(2026, 9, 4))).isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update(
				"INSERT INTO staff_attendance_days (school_id, staff_id, work_date, status_code) VALUES (?, ?, ?, 'X')",
				school.getId(), staff.getId(), LocalDate.of(2026, 9, 3))).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void halfDayLeaveOnlyForSingleDayPaidOrUnpaid() {
		School school = data.school();
		Staff staff = data.staff(school, Position.TEACHER);
		String sql = """
				INSERT INTO leave_requests (school_id, staff_id, leave_code, from_date, to_date, half_day, days, reason)
				VALUES (?, ?, ?, ?, ?, true, 0.5, 'Việc riêng')""";
		jdbc.update(sql, school.getId(), staff.getId(), "P", LocalDate.of(2026, 9, 7), LocalDate.of(2026, 9, 7));
		assertThatThrownBy(() -> jdbc.update(sql, school.getId(), staff.getId(), "P", LocalDate.of(2026, 9, 7),
				LocalDate.of(2026, 9, 8))).isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update(sql, school.getId(), staff.getId(), "O", LocalDate.of(2026, 9, 9),
				LocalDate.of(2026, 9, 9))).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void machineCodeUniqueWithinSchoolAndClearedOnTransfer() {
		School a = data.school();
		School b = data.school();
		Staff first = data.staff(a, Position.TEACHER);
		Staff second = data.staff(a, Position.TEACHER);
		Staff other = data.staff(b, Position.TEACHER);
		jdbc.update("UPDATE staff SET machine_code = 'M01' WHERE id = ?", first.getId());
		jdbc.update("UPDATE staff SET machine_code = 'M01' WHERE id = ?", other.getId());
		assertThatThrownBy(() -> jdbc.update("UPDATE staff SET machine_code = 'M01' WHERE id = ?", second.getId()))
			.isInstanceOf(DataIntegrityViolationException.class);

		tx.executeWithoutResult(s -> em.find(Staff.class, first.getId()).setSchoolId(b.getId()));
		assertThat(jdbc.queryForObject("SELECT machine_code FROM staff WHERE id = ?", String.class, first.getId())).isNull();
		// Đổi cơ sở không kèm phân công mới: xóa mềm để job điều chuyển của test khác không thấy hồ sơ lệch này
		jdbc.update("UPDATE staff SET deleted_at = now() WHERE id = ?", first.getId());
	}

}
