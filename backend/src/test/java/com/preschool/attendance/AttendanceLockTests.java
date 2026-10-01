package com.preschool.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;

import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/** Khóa công tháng: chốt tổng, tháng đã khóa không sửa được, mở khóa chỉ văn phòng điều hành kèm lý do; xuất Excel. */
class AttendanceLockTests extends ApiTestSupport {

	private static final String MONTH = "2026-09";

	@Autowired
	JdbcTemplate jdbc;

	School schoolA;

	User principalA;

	User admin;

	Staff staff;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		principalA = data.vicePrincipal(schoolA, FunctionGroup.HR);
		admin = data.principal(schoolA);
		staff = data.staff(schoolA, Position.TEACHER);
		jdbc.update("UPDATE staff SET machine_code = 'L1' WHERE id = ?", staff.getId());
		jdbc.update("""
				INSERT INTO attendance_configs (organization_id, school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
				  late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days)
				SELECT organization_id, id, '2020-01-01', '07:30', '17:00', '11:30', '13:00', 15, 3, '{1,2,3,4,5,6}', '{6}', 12 FROM schools WHERE id = ?""",
				schoolA.getId());
	}

	private ResultActions putCell(User user, String date, String code) throws Exception {
		return as(user, put("/api/v1/attendance/staff/" + staff.getId() + "/" + date)
			.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"%s\"}".formatted(code)), schoolA.getId());
	}

	@Test
	void lockedMonthCannotBeEditedUntilPrincipalUnlocksWithReason() throws Exception {
		putCell(principalA, "2026-09-03", "X").andExpect(status().isOk());
		putCell(principalA, "2026-09-04", "1/2P").andExpect(status().isOk());

		User teacher = data.userForStaff(RoleCode.TEACHER, schoolA, staff);
		as(teacher, post("/api/v1/attendance/months/" + MONTH + "/lock"), schoolA.getId()).andExpect(status().isForbidden());
		as(principalA, post("/api/v1/attendance/months/" + MONTH + "/lock"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.lock.lockedAt").isNotEmpty());
		assertThat(jdbc.queryForObject(
				"SELECT total_work FROM staff_attendance_months WHERE staff_id = ? AND month = '2026-09-01' AND locked_at IS NOT NULL",
				BigDecimal.class, staff.getId())).isEqualByComparingTo("1.5");

		// Mọi thao tác ghi vào tháng đã khóa bị chặn
		putCell(principalA, "2026-09-05", "X").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ATTENDANCE_MONTH_LOCKED"));
		as(principalA, post("/api/v1/attendance/imports").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\",\"rows\":[{\"machineCode\":\"L1\",\"workDate\":\"2026-09-07\",\"checkIn\":\"07:20\",\"checkOut\":\"17:00\"}]}"
				.formatted(MONTH)), schoolA.getId())
			.andExpect(status().isConflict());
		as(principalA, post("/api/v1/attendance/discrepancies/resolve").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\",\"items\":[{\"staffId\":\"%s\",\"date\":\"2026-09-03\",\"code\":\"K\"}]}"
				.formatted(MONTH, staff.getId())), schoolA.getId())
			.andExpect(status().isConflict());
		as(principalA, post("/api/v1/attendance/months/" + MONTH + "/lock"), schoolA.getId())
			.andExpect(status().isConflict());
		// Tháng khác vẫn sửa được
		putCell(principalA, "2026-10-01", "X").andExpect(status().isOk());

		// Mở khóa: hiệu trưởng không được; văn phòng điều hành phải có lý do
		String reason = "{\"reason\":\"Bổ sung đơn nghỉ ốm\"}";
		as(principalA, post("/api/v1/attendance/months/" + MONTH + "/unlock").contentType(MediaType.APPLICATION_JSON)
			.content(reason), schoolA.getId()).andExpect(status().isForbidden());
		as(admin, post("/api/v1/attendance/months/" + MONTH + "/unlock").contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"  \"}"), schoolA.getId()).andExpect(status().isBadRequest());
		as(admin, post("/api/v1/attendance/months/" + MONTH + "/unlock").contentType(MediaType.APPLICATION_JSON)
			.content(reason), schoolA.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.lock").doesNotExist());
		assertThat(jdbc.queryForObject("""
				SELECT count(*) FROM audit_logs WHERE entity = 'attendance.month' AND after_data->>'reason' = 'Bổ sung đơn nghỉ ốm'""",
				Integer.class)).isEqualTo(1);
		putCell(principalA, "2026-09-05", "X").andExpect(status().isOk());
	}

	@Test
	void exportsMonthSheetAsExcelForViewers() throws Exception {
		putCell(principalA, "2026-09-03", "X").andExpect(status().isOk());
		User accountant = data.user(RoleCode.ACCOUNTANT, schoolA);
		byte[] content = as(accountant, get("/api/v1/attendance/months/" + MONTH + "/export"), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(".xlsx")))
			.andReturn().getResponse().getContentAsByteArray();
		try (XSSFWorkbook book = new XSSFWorkbook(new ByteArrayInputStream(content))) {
			var sheet = book.getSheetAt(0);
			assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("BẢNG CHẤM CÔNG THÁNG 9/2026");
			assertThat(sheet.getRow(5).getCell(1).getStringCellValue()).isEqualTo(staff.getStaffCode());
			// Cột ngày 3 (cột thứ 4 + 2) có mã X
			assertThat(sheet.getRow(5).getCell(4 + 2).getStringCellValue()).isEqualTo("X");
		}
		User teacher = data.user(RoleCode.TEACHER, schoolA);
		as(teacher, get("/api/v1/attendance/months/" + MONTH + "/export"), schoolA.getId())
			.andExpect(status().isForbidden());
	}

}
