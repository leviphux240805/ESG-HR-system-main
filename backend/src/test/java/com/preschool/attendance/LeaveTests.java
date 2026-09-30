package com.preschool.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.notification.repository.NotificationRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/** Đơn nghỉ: duyệt ghi đúng mã vào bảng công và trừ phép, chặn trùng/tháng đã khóa/không đủ phép, quyền duyệt. */
class LeaveTests extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	NotificationRepository notificationRepo;

	School schoolA;

	School schoolB;

	Staff teacherStaff;

	User teacher;

	User principalA;

	Staff principalStaff;

	User principalB;

	User admin;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		principalStaff = data.staff(schoolA, Position.MANAGER);
		principalA = data.userForStaff(RoleCode.PRINCIPAL, schoolA, principalStaff);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		admin = data.user(RoleCode.CHAIN_ADMIN, null);
		for (School school : List.of(schoolA, schoolB)) {
			jdbc.update("""
					INSERT INTO attendance_configs (school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
					  late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days)
					VALUES (?, '2020-01-01', '07:30', '17:00', '11:30', '13:00', 15, 3, '{1,2,3,4,5,6}', '{6}', 12)""",
					school.getId());
		}
	}

	private ResultActions request(User user, String code, String from, String to, boolean halfDay) throws Exception {
		return as(user, post("/api/v1/me/leave-requests").contentType(MediaType.APPLICATION_JSON).content("""
				{"leaveCode":"%s","fromDate":"%s","toDate":"%s","halfDay":%s,"reason":"Việc gia đình"}"""
			.formatted(code, from, to, halfDay)));
	}

	private String create(User user, String code, String from, String to, boolean halfDay) throws Exception {
		return JsonPath.read(request(user, code, from, to, halfDay).andExpect(status().isCreated())
			.andReturn().getResponse().getContentAsString(), "$.id");
	}

	private Map<String, String> codes(Staff staff) {
		Map<String, String> result = new java.util.TreeMap<>();
		jdbc.queryForList("SELECT work_date::text AS d, status_code, source FROM staff_attendance_days WHERE staff_id = ?",
				staff.getId())
			.forEach(r -> result.put((String) r.get("d"), r.get("status_code") + "/" + r.get("source")));
		return result;
	}

	@Test
	void approvalWritesCodesIntoTimesheetAndDeductsLeave() throws Exception {
		// Thứ Hai 2/11 – thứ Tư 4/11/2026: 3 ngày phép
		String id = create(teacher, "P", "2026-11-02", "2026-11-04", false);
		as(teacher, get("/api/v1/me/leave-balance?year=2026")).andExpect(jsonPath("$.pendingDays").value(3))
			.andExpect(jsonPath("$.remaining").value(12));
		// Trùng ngày với đơn đang chờ
		request(teacher, "K", "2026-11-04", "2026-11-05", false).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LEAVE_OVERLAP"));
		assertThat(notificationRepo.findAll().stream()
			.filter(n -> n.getUserId().equals(principalA.getId()) && ("leave:" + id).equals(n.getDedupeKey()))).hasSize(1);

		// Cơ sở khác không thấy, người xin không tự duyệt
		as(principalB, get("/api/v1/leave-requests?status=PENDING"), schoolB.getId())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));
		as(principalB, post("/api/v1/leave-requests/" + id + "/approve"), schoolB.getId()).andExpect(status().isNotFound());
		as(teacher, post("/api/v1/leave-requests/" + id + "/approve"), schoolA.getId()).andExpect(status().isForbidden());

		as(principalA, get("/api/v1/leave-requests?status=PENDING"), schoolA.getId())
			.andExpect(jsonPath("$.items[?(@.id == '%s')].canReview".formatted(id)).value(true));
		as(principalA, post("/api/v1/leave-requests/" + id + "/approve"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("APPROVED"));

		assertThat(codes(teacherStaff)).containsExactlyEntriesOf(new java.util.TreeMap<>(Map.of("2026-11-02", "P/LEAVE",
				"2026-11-03", "P/LEAVE", "2026-11-04", "P/LEAVE")));
		as(teacher, get("/api/v1/me/leave-balance?year=2026")).andExpect(jsonPath("$.usedDays").value(3))
			.andExpect(jsonPath("$.remaining").value(9)).andExpect(jsonPath("$.pendingDays").value(0));
		assertThat(notificationRepo.findAll().stream()
			.filter(n -> n.getUserId().equals(teacher.getId()) && ("leave-result:" + id).equals(n.getDedupeKey())))
			.hasSize(1);
		as(principalA, get("/api/v1/attendance/staff?month=2026-11"), schoolA.getId())
			.andExpect(jsonPath("$.staff[?(@.staffId == '%s')].totals.paidLeave".formatted(teacherStaff.getId()))
				.value(3.0));
		as(principalA, get("/api/v1/leave-requests/calendar?month=2026-11"), schoolA.getId())
			.andExpect(jsonPath("$[0].attendanceCode").value("P"));
		// Đã duyệt thì không hủy được
		as(teacher, post("/api/v1/me/leave-requests/" + id + "/cancel")).andExpect(status().isConflict());
	}

	@Test
	void workingDaysSkipWeekendHolidayAndHalfDaySaturday() throws Exception {
		jdbc.update("INSERT INTO holidays (school_id, holiday_date, name) VALUES (?, '2026-11-09', 'Lễ trường')",
				schoolA.getId());
		// T6 6/11 (1) + T7 7/11 (0,5) + CN 8/11 (0) + T2 9/11 lễ (0) = 1,5
		String id = JsonPath.read(request(teacher, "K", "2026-11-06", "2026-11-09", false)
			.andExpect(status().isCreated()).andExpect(jsonPath("$.days").value(1.5))
			.andReturn().getResponse().getContentAsString(), "$.id");
		as(principalA, post("/api/v1/leave-requests/" + id + "/approve"), schoolA.getId()).andExpect(status().isOk());
		assertThat(codes(teacherStaff)).containsOnlyKeys("2026-11-06", "2026-11-07")
			.containsEntry("2026-11-07", "K/LEAVE");

		// Nửa ngày → 1/2P; chỉ một ngày, chỉ P/K; khoảng toàn ngày nghỉ bị chặn
		String half = JsonPath.read(request(teacher, "P", "2026-11-10", "2026-11-10", true)
			.andExpect(status().isCreated()).andExpect(jsonPath("$.attendanceCode").value("1/2P"))
			.andExpect(jsonPath("$.days").value(0.5))
			.andReturn().getResponse().getContentAsString(), "$.id");
		request(teacher, "O", "2026-11-11", "2026-11-11", true).andExpect(status().isBadRequest());
		request(teacher, "P", "2026-11-15", "2026-11-15", false).andExpect(status().isBadRequest());
		as(admin, post("/api/v1/leave-requests/" + half + "/approve"), schoolA.getId()).andExpect(status().isOk());
		assertThat(codes(teacherStaff)).containsEntry("2026-11-10", "1/2P/LEAVE");
	}

	@Test
	void lockedMonthAndInsufficientBalanceAreBlocked() throws Exception {
		String pending = create(teacher, "P", "2026-11-16", "2026-11-16", false);
		as(principalA, post("/api/v1/attendance/months/2026-11/lock"), schoolA.getId()).andExpect(status().isOk());
		request(teacher, "K", "2026-11-20", "2026-11-20", false).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ATTENDANCE_MONTH_LOCKED"));
		as(principalA, post("/api/v1/leave-requests/" + pending + "/approve"), schoolA.getId())
			.andExpect(status().isConflict());
		assertThat(codes(teacherStaff)).isEmpty();

		// 12 ngày phép năm, đã chờ 1 → xin thêm 12 ngày không đủ
		request(teacher, "P", "2026-12-01", "2026-12-15", false).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("LEAVE_BALANCE"));
	}

	@Test
	void principalLeaveIsApprovedByChainAdminAndBulkApprovalReportsFailures() throws Exception {
		String own = create(principalA, "P", "2026-11-17", "2026-11-17", false);
		as(principalA, post("/api/v1/leave-requests/" + own + "/approve"), schoolA.getId())
			.andExpect(status().isForbidden());
		String teacherLeave = create(teacher, "CO", "2026-11-18", "2026-11-18", false);
		String cancelled = create(teacher, "K", "2026-11-19", "2026-11-19", false);
		as(teacher, post("/api/v1/me/leave-requests/" + cancelled + "/cancel")).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		String body = as(admin, post("/api/v1/leave-requests/approve").contentType(MediaType.APPLICATION_JSON)
			.content("{\"ids\":[\"%s\",\"%s\",\"%s\"]}".formatted(own, teacherLeave, cancelled)), schoolA.getId())
			.andExpect(status().isOk()).andExpect(jsonPath("$.approved").value(2))
			.andExpect(jsonPath("$.failed.length()").value(1))
			.andReturn().getResponse().getContentAsString();
		assertThat((String) JsonPath.read(body, "$.failed[0].id")).isEqualTo(cancelled);
		assertThat(codes(principalStaff)).containsEntry("2026-11-17", "P/LEAVE");
		assertThat(codes(teacherStaff)).containsEntry("2026-11-18", "CO/LEAVE");

		// Từ chối cần lý do
		String rejected = create(teacher, "K", "2026-11-23", "2026-11-23", false);
		as(principalA, post("/api/v1/leave-requests/" + rejected + "/reject").contentType(MediaType.APPLICATION_JSON)
			.content("{}"), schoolA.getId()).andExpect(status().isBadRequest());
		as(principalA, post("/api/v1/leave-requests/" + rejected + "/reject").contentType(MediaType.APPLICATION_JSON)
			.content("{\"note\":\"Trùng lịch họp phụ huynh\"}"), schoolA.getId())
			.andExpect(jsonPath("$.status").value("REJECTED"));
		assertThat(jdbc.queryForObject("SELECT used_days FROM leave_balances WHERE staff_id = ? AND year = 2026",
				BigDecimal.class, principalStaff.getId())).isEqualByComparingTo("1");
	}

}
