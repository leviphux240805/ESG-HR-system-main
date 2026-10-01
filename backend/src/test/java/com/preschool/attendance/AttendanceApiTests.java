package com.preschool.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.InputStream;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Bảng công: import + đối soát khớp bản cũ, quyền xem/sửa, chéo cơ sở, xử lý sai lệch. */
class AttendanceApiTests extends ApiTestSupport {

	private static final String MONTH = "2026-09";

	@Autowired
	JdbcTemplate jdbc;

	School schoolA;

	School schoolB;

	User principalA;

	User principalB;

	/** Mã chấm công trong file mẫu → nhân viên Cơ sở A. */
	Map<String, Staff> staffByCode = new HashMap<>();

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		// Cấu hình giống bản cũ: vào 07:30, nghỉ trưa 11:30–13:00, T7 nửa buổi, ân hạn 15 phút, muộn nhẹ 3 lần
		for (School school : List.of(schoolA, schoolB)) {
			jdbc.update("""
					INSERT INTO attendance_configs (organization_id, school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
					  late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days)
					SELECT organization_id, id, '2020-01-01', '07:30', '17:00', '11:30', '13:00', 15, 3, '{1,2,3,4,5,6}', '{6}', 12 FROM schools WHERE id = ?""",
					school.getId());
		}
		for (String code : List.of("101", "102", "103", "104", "105", "106", "107")) {
			Staff staff = data.staff(schoolA, Position.TEACHER);
			jdbc.update("UPDATE staff SET machine_code = ? WHERE id = ?", code, staff.getId());
			staffByCode.put(code, staff);
		}
	}

	private static JsonNode fixture() throws Exception {
		try (InputStream in = AttendanceApiTests.class.getResourceAsStream("/attendance/sample-2026-09.json")) {
			return JsonMapper.builder().build().readTree(in);
		}
	}

	private ResultActions putCell(User user, UUID schoolHeader, UUID staffId, String date, String code) throws Exception {
		return as(user, put("/api/v1/attendance/staff/" + staffId + "/" + date).contentType(MediaType.APPLICATION_JSON)
			.content(code == null ? "{}" : "{\"code\":\"%s\"}".formatted(code)), schoolHeader);
	}

	private String importJson(JsonNode punches) {
		String rows = java.util.stream.StreamSupport.stream(punches.spliterator(), false)
			.map(p -> "{\"machineCode\":\"%s\",\"name\":\"NV %s\",\"workDate\":\"%s\",\"checkIn\":%s,\"checkOut\":%s}"
				.formatted(p.get("code").asString(), p.get("code").asString(), p.get("date").asString(),
						p.get("checkIn").isNull() ? "null" : "\"" + p.get("checkIn").asString() + "\"",
						p.get("checkOut").isNull() ? "null" : "\"" + p.get("checkOut").asString() + "\""))
			.collect(Collectors.joining(","));
		return "{\"month\":\"%s\",\"rows\":[%s]}".formatted(MONTH, rows);
	}

	@Test
	void importMatchesLegacyReconciliationOnSampleFile() throws Exception {
		JsonNode fixture = fixture();
		// Mã chấm tay có sẵn trước khi import (như dữ liệu HR của bản cũ)
		for (JsonNode m : fixture.get("manual")) {
			putCell(principalA, schoolA.getId(), staffByCode.get(m.get("code").asString()).getId(),
					m.get("date").asString(), m.get("status").asString())
				.andExpect(status().isOk());
		}

		String body = as(principalA, post("/api/v1/attendance/imports").contentType(MediaType.APPLICATION_JSON)
			.content(importJson(fixture.get("punches"))), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.unmatched[0].machineCode").value("999"))
			.andExpect(jsonPath("$.unmatched[0].rows").value(2))
			.andExpect(jsonPath("$.staffCount").value(6))
			.andReturn().getResponse().getContentAsString();
		int expectedDiscrepancies = 0;
		for (JsonNode e : fixture.get("expected")) {
			expectedDiscrepancies += e.get("discrepancy").asBoolean() ? 1 : 0;
		}
		assertThat((Integer) JsonPath.read(body, "$.discrepancyCount")).isEqualTo(expectedDiscrepancies);

		// Từng (người, ngày) trong kết quả chuẩn của bản TS cũ
		Map<UUID, String> codeByStaff = staffByCode.entrySet().stream()
			.collect(Collectors.toMap(e -> e.getValue().getId(), Map.Entry::getKey));
		Map<String, Map<String, Object>> stored = jdbc.queryForList("""
				SELECT staff_id, work_date, late_minutes, is_counted_late, is_discrepancy, discrepancy_reason, suggested_status
				FROM staff_attendance_days WHERE school_id = ?""", schoolA.getId())
			.stream()
			.collect(Collectors.toMap(r -> codeByStaff.get((UUID) r.get("staff_id")) + "|" + r.get("work_date"), r -> r));
		int compared = 0;
		for (JsonNode e : fixture.get("expected")) {
			if (!staffByCode.containsKey(e.get("code").asString())) {
				continue; // mã 999 không có trong hệ thống
			}
			Map<String, Object> row = stored.get(e.get("code").asString() + "|" + e.get("date").asString());
			assertThat(row).as("%s %s", e.get("code"), e.get("date")).isNotNull();
			assertThat(row.get("late_minutes")).as("phút muộn %s %s", e.get("code"), e.get("date"))
				.isEqualTo(e.get("lateMinutes").asInt());
			assertThat(row.get("is_counted_late")).isEqualTo(e.get("countedLate").asBoolean());
			assertThat(row.get("is_discrepancy")).as("sai lệch %s %s", e.get("code"), e.get("date"))
				.isEqualTo(e.get("discrepancy").asBoolean());
			assertThat(row.get("discrepancy_reason")).isEqualTo(e.get("reason").isNull() ? null : e.get("reason").asString());
			assertThat(row.get("suggested_status"))
				.isEqualTo(e.get("suggested").isNull() ? null : e.get("suggested").asString());
			compared++;
		}
		assertThat(compared).isGreaterThan(140);

		// Mã tự điền (sửa lỗi bản cũ): ngày đủ giờ vào/ra → X, máy ghi vắng → K, thiếu giờ ra → để trống
		String sheet = as(principalA, get("/api/v1/attendance/staff?month=" + MONTH), schoolA.getId())
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		String s101 = staffByCode.get("101").getId().toString();
		String s103 = staffByCode.get("103").getId().toString();
		assertThat(JsonPath.read(sheet, "$.staff[?(@.staffId == '%s')].cells['2026-09-07'].code".formatted(s101))
			.toString()).contains("X");
		assertThat(JsonPath.read(sheet, "$.staff[?(@.staffId == '%s')].cells['2026-09-15'].code".formatted(s103))
			.toString()).contains("K");
		assertThat(JsonPath.read(sheet, "$.staff[?(@.staffId == '%s')].cells['2026-09-10'].code".formatted(s103))
			.toString()).isEqualTo("[null]");
		assertThat((Integer) JsonPath.read(sheet, "$.discrepancyCount")).isEqualTo(expectedDiscrepancies);
	}

	@Test
	void reimportDoesNotTreatAutoFilledCodesAsManual() throws Exception {
		Staff staff = staffByCode.get("101");
		String ok = "{\"month\":\"%s\",\"rows\":[{\"machineCode\":\"101\",\"workDate\":\"2026-09-03\",\"checkIn\":\"07:20\",\"checkOut\":\"17:00\"}]}"
			.formatted(MONTH);
		as(principalA, post("/api/v1/attendance/imports").contentType(MediaType.APPLICATION_JSON).content(ok),
				schoolA.getId())
			.andExpect(jsonPath("$.autoFilled").value(1));
		// Lần sau máy chỉ có giờ vào: bỏ X tự điền, báo thiếu giờ về
		String missing = ok.replace("\"17:00\"", "null");
		as(principalA, post("/api/v1/attendance/imports").contentType(MediaType.APPLICATION_JSON).content(missing),
				schoolA.getId())
			.andExpect(jsonPath("$.discrepancyCount").value(1)).andExpect(jsonPath("$.autoFilled").value(0));
		as(principalA, get("/api/v1/attendance/staff/" + staff.getId() + "/2026-09-03"), schoolA.getId())
			.andExpect(jsonPath("$.code").doesNotExist())
			.andExpect(jsonPath("$.checkIn").value("07:20"))
			.andExpect(jsonPath("$.discrepancyReason").value("Có giờ vào, thiếu giờ về - Có thể quên chấm công về"))
			.andExpect(jsonPath("$.suggestedStatus").value("X"));

		// Xử lý sai lệch hàng loạt
		as(principalA, get("/api/v1/attendance/discrepancies?month=" + MONTH), schoolA.getId())
			.andExpect(jsonPath("$.length()").value(1));
		as(principalA, post("/api/v1/attendance/discrepancies/resolve").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\",\"items\":[{\"staffId\":\"%s\",\"date\":\"2026-09-03\",\"code\":\"x\"}]}"
				.formatted(MONTH, staff.getId())), schoolA.getId())
			.andExpect(status().isOk());
		as(principalA, get("/api/v1/attendance/discrepancies?month=" + MONTH), schoolA.getId())
			.andExpect(jsonPath("$.length()").value(0));
		as(principalA, get("/api/v1/attendance/staff/" + staff.getId() + "/2026-09-03"), schoolA.getId())
			.andExpect(jsonPath("$.code").value("X")).andExpect(jsonPath("$.source").value("MANUAL"));
	}

	@Test
	void sheetTotalsAndCellValidation() throws Exception {
		UUID staffId = staffByCode.get("102").getId();
		putCell(principalA, schoolA.getId(), staffId, "2026-09-03", "X").andExpect(status().isOk());
		putCell(principalA, schoolA.getId(), staffId, "2026-09-04", "1/2P").andExpect(status().isOk());
		putCell(principalA, schoolA.getId(), staffId, "2026-09-05", "K").andExpect(status().isOk());
		putCell(principalA, schoolA.getId(), staffId, "2026-09-07", "ZZ").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("code"));
		putCell(principalA, schoolA.getId(), staffId, "2026-09-05", null).andExpect(status().isOk())
			.andExpect(jsonPath("$.code").doesNotExist());

		as(principalA, get("/api/v1/attendance/staff?month=" + MONTH), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.staff.length()").value(7))
			.andExpect(jsonPath("$.days.length()").value(30))
			.andExpect(jsonPath("$.days[5].working").value(false)) // 6/9 Chủ nhật
			.andExpect(jsonPath("$.days[4].halfDay").value(true)) // 5/9 thứ Bảy
			.andExpect(jsonPath("$.staff[?(@.staffId == '%s')].totals.totalWork".formatted(staffId)).value(1.5))
			.andExpect(jsonPath("$.staff[?(@.staffId == '%s')].totals.paidLeave".formatted(staffId)).value(0.5))
			.andExpect(jsonPath("$.canManage").value(true));
	}

	@Test
	void teacherCannotViewSheetAndOtherSchoolCannotReadOrEdit() throws Exception {
		Staff teacherStaff = staffByCode.get("101");
		User teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		as(teacher, get("/api/v1/attendance/staff?month=" + MONTH), schoolA.getId()).andExpect(status().isForbidden());
		as(teacher, get("/api/v1/attendance/staff/" + staffByCode.get("102").getId() + "/2026-09-03"), schoolA.getId())
			.andExpect(status().isForbidden());
		putCell(teacher, schoolA.getId(), teacherStaff.getId(), "2026-09-03", "X").andExpect(status().isForbidden());
		// Nhưng xem được bảng công của chính mình
		putCell(principalA, schoolA.getId(), teacherStaff.getId(), "2026-09-03", "X").andExpect(status().isOk());
		putCell(principalA, schoolA.getId(), staffByCode.get("102").getId(), "2026-09-03", "K").andExpect(status().isOk());
		as(teacher, get("/api/v1/me/attendance?month=" + MONTH)).andExpect(status().isOk())
			.andExpect(jsonPath("$.staffId").value(teacherStaff.getId().toString()))
			.andExpect(jsonPath("$.cells['2026-09-03'].code").value("X"))
			.andExpect(jsonPath("$.totals.totalWork").value(1.0))
			.andExpect(jsonPath("$.days.length()").value(30));
		as(principalB, get("/api/v1/me/attendance?month=" + MONTH)).andExpect(status().isNotFound());

		// Hiệu trưởng B: bảng công của B không có nhân viên A; sửa ô nhân viên A → 404; chọn cơ sở A → bị chặn
		as(principalB, get("/api/v1/attendance/staff?month=" + MONTH), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.staff.length()").value(0));
		putCell(principalB, schoolB.getId(), teacherStaff.getId(), "2026-09-03", "X").andExpect(status().isNotFound());
		putCell(principalB, schoolA.getId(), teacherStaff.getId(), "2026-09-03", "X").andExpect(status().isForbidden());
		as(principalB, post("/api/v1/attendance/imports").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\",\"rows\":[{\"machineCode\":\"101\",\"workDate\":\"2026-09-03\",\"checkIn\":\"07:20\",\"checkOut\":\"17:00\"}]}"
				.formatted(MONTH)), schoolB.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.unmatched[0].machineCode").value("101")); // mã 101 không thuộc Cơ sở B
		assertThat(jdbc.queryForObject("SELECT count(*) FROM attendance_punches WHERE staff_id = ?", Integer.class,
				teacherStaff.getId())).isZero();
	}

}
