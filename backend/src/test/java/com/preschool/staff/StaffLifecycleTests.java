package com.preschool.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;

import com.preschool.TestData;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.service.StaffLifecycleService;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** Lương, điều chuyển, nghỉ việc, lịch sử, xuất Excel (test bắt buộc giai đoạn 2). */
class StaffLifecycleTests extends ApiTestSupport {

	@Autowired
	StaffLifecycleService lifecycle;

	School schoolA;

	School schoolB;

	Staff staffA;

	User admin;

	User principalA;

	@BeforeEach
	void setUpStaff() {
		schoolA = data.school();
		schoolB = data.school();
		staffA = data.staff(schoolA, Position.TEACHER);
		admin = data.principal(schoolA, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
	}

	@Test
	void hrVicePrincipalCannotReadSalaryEvenInHistory() throws Exception {
		User viceHr = data.vicePrincipal(schoolA, FunctionGroup.HR);
		addSalary(admin, "2026-01-01", 8_500_000).andExpect(status().isCreated());

		as(viceHr, get(salaryUrl())).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("SALARY_FORBIDDEN"));
		as(viceHr, get("/api/v1/staff/" + staffA.getId() + "/history")).andExpect(status().isOk())
			.andExpect(jsonPath("$.salaryConfigs").doesNotExist())
			.andExpect(jsonPath("$.events[*].entity", not(hasItem("staff.salary"))));
		addSalary(viceHr, "2026-06-01", 9_000_000).andExpect(status().isForbidden());
	}

	@Test
	void accountantReadsSalaryOnlyAdminAddsNewVersionsWithoutOverwriting() throws Exception {
		User accountant = data.user(RoleCode.ACCOUNTANT, schoolA);
		addSalary(admin, "2026-01-01", 8_500_000).andExpect(status().isCreated());
		addSalary(admin, "2026-01-01", 9_999_999).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("effectiveFrom"));
		addSalary(admin, "2027-01-01", 9_500_000).andExpect(status().isCreated());

		as(accountant, get(salaryUrl())).andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[0].effectiveFrom").value("2027-01-01"))
			.andExpect(jsonPath("$[1].baseSalary").value(8500000))
			.andExpect(jsonPath("$[1].allowances.lunch").value(730000))
			.andExpect(jsonPath("$[1].current").value(true));
		addSalary(accountant, "2028-01-01", 1).andExpect(status().isForbidden());
		as(admin, get("/api/v1/staff/" + staffA.getId() + "/history")).andExpect(status().isOk())
			.andExpect(jsonPath("$.events[*].entity", hasItem("staff.salary")));
	}

	@Test
	void immediateTransferMovesVisibilityAndKeepsHistory() throws Exception {
		String decision = uploadPdf(admin, "qd-dieu-chuyen.pdf");
		LocalDate today = LocalDate.now(TestData.VN);

		as(admin, post(transferUrl()).contentType(MediaType.APPLICATION_JSON)
			.content(transferJson(schoolB, today, decision))).andExpect(status().isOk())
			.andExpect(jsonPath("$.schoolId").value(schoolB.getId().toString()));

		User principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		as(principalA, get("/api/v1/staff/" + staffA.getId())).andExpect(status().isNotFound());
		as(principalB, get("/api/v1/staff/" + staffA.getId() + "/history")).andExpect(status().isOk())
			.andExpect(jsonPath("$.assignments.length()").value(2))
			.andExpect(jsonPath("$.assignments[0].schoolId").value(schoolA.getId().toString()))
			.andExpect(jsonPath("$.assignments[0].toDate").value(today.minusDays(1).toString()))
			.andExpect(jsonPath("$.assignments[1].schoolId").value(schoolB.getId().toString()))
			.andExpect(jsonPath("$.assignments[1].decisionFile.originalName").value("qd-dieu-chuyen.pdf"))
			.andExpect(jsonPath("$.events[*].entity", hasItem("staff.transfer")));
		// Quyết định nằm trong giấy tờ của nhân viên; hiệu trưởng cơ sở mới xem được file cũ của hồ sơ
		as(principalB, get("/api/v1/staff/" + staffA.getId() + "/documents")).andExpect(status().isOk())
			.andExpect(jsonPath("$[0].type.code").value("QUYET_DINH_DIEU_CHUYEN"));
		as(principalB, get("/api/v1/staff/" + staffA.getId() + "/files/" + decision + "/download-url"))
			.andExpect(status().isOk());
	}

	@Test
	void futureTransferIsAppliedByDailyJob() throws Exception {
		LocalDate effective = LocalDate.now(TestData.VN).plusDays(10);
		as(admin, post(transferUrl()).contentType(MediaType.APPLICATION_JSON)
			.content(transferJson(schoolB, effective, null))).andExpect(status().isOk())
			.andExpect(jsonPath("$.schoolId").value(schoolA.getId().toString()));
		as(principalA, get("/api/v1/staff/" + staffA.getId() + "/history")).andExpect(status().isOk())
			.andExpect(jsonPath("$.assignments[1].pending").value(true));
		// Không đặt ngày trước lần điều chuyển gần nhất
		as(admin, post(transferUrl()).contentType(MediaType.APPLICATION_JSON)
			.content(transferJson(schoolA, effective.minusDays(1), null))).andExpect(status().isBadRequest());

		assertThat(lifecycle.applyDueTransfers(effective.minusDays(1))).isZero();
		assertThat(lifecycle.applyDueTransfers(effective)).isGreaterThanOrEqualTo(1);
		as(principalA, get("/api/v1/staff/" + staffA.getId())).andExpect(status().isNotFound());
	}

	@Test
	void principalCannotTransferButCanTerminateWhichLocksLogin() throws Exception {
		User staffUser = data.userForStaff(RoleCode.TEACHER, schoolA, staffA);
		as(principalA, post(transferUrl()).contentType(MediaType.APPLICATION_JSON)
			.content(transferJson(schoolB, LocalDate.now(TestData.VN), null))).andExpect(status().isForbidden());

		as(principalA, post("/api/v1/staff/" + staffA.getId() + "/terminate").contentType(MediaType.APPLICATION_JSON)
			.content("{\"endDate\":\"%s\",\"reason\":\"Nghỉ theo nguyện vọng\"}".formatted(LocalDate.now(TestData.VN))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("TERMINATED"));

		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"%s\",\"password\":\"Matkhau@123\"}".formatted(staffUser.getEmail())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
	}

	@Test
	void exportRespectsScope() throws Exception {
		data.staff(schoolB, Position.COOK);
		User owner = data.principal(schoolA, schoolB);

		byte[] mine = as(principalA, get("/api/v1/staff/export")).andExpect(status().isOk())
			.andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
			.andReturn().getResponse().getContentAsByteArray();
		byte[] all = as(owner, get("/api/v1/staff/export")).andExpect(status().isOk())
			.andReturn().getResponse().getContentAsByteArray();
		byte[] selected = as(owner, get("/api/v1/staff/export?ids=" + staffA.getId())).andExpect(status().isOk())
			.andReturn().getResponse().getContentAsByteArray();

		assertThat(rows(all)).isGreaterThan(rows(mine));
		assertThat(rows(selected)).isEqualTo(1);
		try (XSSFWorkbook book = new XSSFWorkbook(new ByteArrayInputStream(mine))) {
			assertThat(book.getSheetAt(0).getRow(0).getCell(1).getStringCellValue()).isEqualTo("Họ tên");
		}
	}

	private static int rows(byte[] xlsx) throws Exception {
		try (XSSFWorkbook book = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
			return book.getSheetAt(0).getLastRowNum();
		}
	}

	private org.springframework.test.web.servlet.ResultActions addSalary(User user, String from, long base)
			throws Exception {
		return as(user, post(salaryUrl()).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"effectiveFrom":"%s","salaryMode":"FIXED","baseSalary":%d,"region":"I","allowances":{"lunch":730000}}"""
				.formatted(from, base)));
	}

	private String salaryUrl() {
		return "/api/v1/staff/" + staffA.getId() + "/salary-configs";
	}

	private String transferUrl() {
		return "/api/v1/staff/" + staffA.getId() + "/transfer";
	}

	private static String transferJson(School to, LocalDate effective, String decisionFileId) {
		return "{\"schoolId\":\"%s\",\"effectiveDate\":\"%s\",\"decisionFileId\":%s}".formatted(to.getId(), effective,
				decisionFileId == null ? "null" : "\"" + decisionFileId + "\"");
	}

}
