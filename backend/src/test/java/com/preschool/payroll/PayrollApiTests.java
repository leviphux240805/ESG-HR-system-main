package com.preschool.payroll;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
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

/**
 * Bảng lương: tính từ bảng công đã khóa và cấu hình lương; kế toán tính, sửa thưởng/phạt, đánh dấu đã trả; chỉ hiệu
 * trưởng duyệt, mở lại; bảng đã duyệt không sửa được; nhân viên chỉ xem phiếu của mình khi đã duyệt; trường khác không
 * xem được.
 */
class PayrollApiTests extends ApiTestSupport {

	private static final String MONTH = "2026-09";

	@Autowired
	JdbcTemplate jdbc;

	School schoolA;

	School schoolB;

	User principalA;

	User principalB;

	User accountantA;

	Staff teacherStaff;

	User teacher;

	Staff noConfig;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		principalA = data.principal(schoolA);
		principalB = data.principal(schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		noConfig = data.staff(schoolA, Position.NANNY);
		// Thứ Hai – thứ Sáu: tháng 9/2026 có 22 công chuẩn
		jdbc.update("""
				INSERT INTO attendance_configs (organization_id, school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
				  late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days)
				SELECT organization_id, id, '2020-01-01', '07:30', '17:00', '11:30', '13:00', 15, 3, '{1,2,3,4,5}', '{}', 12 FROM schools WHERE id = ?""",
				schoolA.getId());
		as(principalA, post("/api/v1/staff/" + teacherStaff.getId() + "/salary-configs").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"effectiveFrom":"2026-01-01","salaryMode":"FIXED","baseSalary":11000000,"region":"I","allowances":{"lunch":730000}}"""),
				schoolA.getId())
			.andExpect(status().isCreated());
		for (String day : new String[] { "2026-09-01", "2026-09-02" }) {
			as(principalA, put("/api/v1/attendance/staff/" + teacherStaff.getId() + "/" + day).contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"X\"}"), schoolA.getId()).andExpect(status().isOk());
		}
		as(principalA, put("/api/v1/attendance/staff/" + teacherStaff.getId() + "/2026-09-03").contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"P\"}"), schoolA.getId()).andExpect(status().isOk());
	}

	private ResultActions call(User user, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
			School school) throws Exception {
		return as(user, request, school.getId());
	}

	private void lockMonth() throws Exception {
		call(principalA, post("/api/v1/attendance/months/" + MONTH + "/lock"), schoolA).andExpect(status().isOk());
	}

	@Test
	void calculateNeedsLockedTimesheetAndUsesSalaryConfig() throws Exception {
		call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/calculate"), schoolA).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ATTENDANCE_NOT_LOCKED"));
		lockMonth();
		String row = "$.rows[?(@.staffId=='%s')]".formatted(teacherStaff.getId());
		call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/calculate"), schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("DRAFT"))
			.andExpect(jsonPath("$.standardWorkDays").value(22))
			// 2 công + 1 ngày phép năm = 3 công hưởng lương: 11.000.000 × 3 / 22
			.andExpect(jsonPath(row + ".workDays").value(3.0))
			.andExpect(jsonPath(row + ".salaryByWork").value(1500000))
			.andExpect(jsonPath(row + ".allowances").value(730000))
			.andExpect(jsonPath("$.missingConfig", hasItem(noConfig.getFullName())));
		call(teacher, get("/api/v1/payroll/periods/" + MONTH), schoolA).andExpect(status().isForbidden());
		call(data.vicePrincipal(schoolA, FunctionGroup.FINANCE), get("/api/v1/payroll/periods/" + MONTH), schoolA)
			.andExpect(status().isOk());
		call(data.vicePrincipal(schoolA, FunctionGroup.HR), get("/api/v1/payroll/periods/" + MONTH), schoolA)
			.andExpect(status().isForbidden());
	}

	@Test
	void approvedPayrollIsLockedAndVisibleToStaffOnly() throws Exception {
		lockMonth();
		String sheet = call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/calculate"), schoolA)
			.andReturn().getResponse().getContentAsString();
		String recordId = JsonPath.read(sheet, "$.rows[0].id");
		long net = ((Number) JsonPath.read(sheet, "$.rows[0].netSalary")).longValue();

		call(accountantA, put("/api/v1/payroll/records/" + recordId).contentType(MediaType.APPLICATION_JSON)
			.content("{\"bonus\":500000,\"fines\":0,\"note\":\"Thưởng lễ\"}"), schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.bonus").value(500000))
			.andExpect(jsonPath("$.netSalary").value(org.hamcrest.Matchers.greaterThan((int) net)));
		call(teacher, get("/api/v1/me/payslips"), schoolA).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		call(teacher, get("/api/v1/payroll/records/" + recordId), schoolA).andExpect(status().isNotFound());

		call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/approve"), schoolA).andExpect(status().isForbidden());
		call(principalA, post("/api/v1/payroll/periods/" + MONTH + "/approve"), schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("APPROVED"));
		call(accountantA, put("/api/v1/payroll/records/" + recordId).contentType(MediaType.APPLICATION_JSON)
			.content("{\"bonus\":0,\"fines\":0}"), schoolA).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("PAYROLL_LOCKED"));
		call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/calculate"), schoolA).andExpect(status().isConflict());

		call(teacher, get("/api/v1/me/payslips"), schoolA).andExpect(jsonPath("$[0].id").value(recordId));
		call(teacher, get("/api/v1/payroll/records/" + recordId), schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.allowances.lunch").value(730000))
			.andExpect(jsonPath("$.note").value("Thưởng lễ"));
		call(teacher, get("/api/v1/payroll/records/" + recordId + "/pdf"), schoolA).andExpect(status().isOk())
			.andExpect(header().string("Content-Type", startsWith("application/pdf")));
		call(accountantA, get("/api/v1/payroll/periods/" + MONTH + "/export"), schoolA).andExpect(status().isOk())
			.andExpect(header().string("Content-Type", startsWith("application/vnd.openxmlformats")));
		// Báo cáo › xuất bảng lương lấy đúng dữ liệu đã tính, ghi trạng thái
		byte[] report = call(principalA, get("/api/v1/reports/payroll/export?month=" + MONTH), schoolA)
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
		try (var book = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(report))) {
			var xlsx = book.getSheetAt(0);
			var row = java.util.stream.IntStream.rangeClosed(3, xlsx.getLastRowNum()).mapToObj(xlsx::getRow)
				.filter(r -> teacherStaff.getStaffCode().equals(r.getCell(1).getStringCellValue()))
				.findFirst()
				.orElseThrow();
			org.assertj.core.api.Assertions.assertThat(row.getCell(8).getStringCellValue()).isEqualTo("Đã duyệt");
		}

		// Mở lại cần lý do; trả lương cần đã duyệt
		call(principalA, post("/api/v1/payroll/periods/" + MONTH + "/reopen").contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\" \"}"), schoolA).andExpect(status().isBadRequest());
		call(principalA, post("/api/v1/payroll/periods/" + MONTH + "/reopen").contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"Sai công\"}"), schoolA).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
		call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/pay"), schoolA).andExpect(status().isConflict());
		call(principalA, post("/api/v1/payroll/periods/" + MONTH + "/approve"), schoolA).andExpect(status().isOk());
		call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/pay"), schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PAID"));
	}

	@Test
	void otherSchoolCannotSeePayroll() throws Exception {
		lockMonth();
		String sheet = call(accountantA, post("/api/v1/payroll/periods/" + MONTH + "/calculate"), schoolA)
			.andReturn().getResponse().getContentAsString();
		String recordId = JsonPath.read(sheet, "$.rows[0].id");
		call(principalB, get("/api/v1/payroll/periods/" + MONTH), schoolA).andExpect(status().isForbidden());
		call(principalB, get("/api/v1/payroll/periods/" + MONTH), schoolB).andExpect(status().isOk())
			.andExpect(jsonPath("$.rows.length()").value(0));
		call(principalB, get("/api/v1/payroll/records/" + recordId), schoolB).andExpect(status().isNotFound());
		call(principalB, put("/api/v1/payroll/records/" + recordId).contentType(MediaType.APPLICATION_JSON)
			.content("{\"bonus\":1,\"fines\":0}"), schoolB).andExpect(status().isNotFound());
		as(principalA, get("/api/v1/payroll/periods/" + MONTH)).andExpect(status().isOk());
		as(data.principal(schoolA, schoolB), get("/api/v1/payroll/periods/" + MONTH)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("SCHOOL_REQUIRED"));
	}

}
