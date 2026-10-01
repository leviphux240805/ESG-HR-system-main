package com.preschool.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.health.HealthApiTestBase;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Báo cáo: hiệu trưởng chỉ thấy cơ sở mình, kế toán chỉ thấy chỉ số tài chính, giáo viên không truy cập; chủ chuỗi so
 * sánh được nhiều cơ sở; file Excel chỉ chứa dữ liệu trong phạm vi.
 */
class ReportApiTests extends HealthApiTestBase {

	User owner;

	User accountantA;

	User teacher;

	@BeforeEach
	void setUp() throws Exception {
		setUpSchools();
		owner = data.principal(schoolA, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		String classId = createClass("Lá 1");
		teacher = teacherOf(classId);
		enroll("Ánh", classId, "Dị ứng tôm");
		enroll("Bảo", classId, null);
	}

	@Test
	void principalSeesOnlyOwnSchool() throws Exception {
		as(principalA, get("/api/v1/reports/dashboard"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.chainView").value(false))
			.andExpect(jsonPath("$.schools", hasSize(1)))
			.andExpect(jsonPath("$.schools[0].schoolId").value(schoolA.getId().toString()))
			.andExpect(jsonPath("$.schools[0].children").value(2))
			.andExpect(jsonPath("$.totals.receivable").value(0))
			.andExpect(jsonPath("$.cashTrend", hasSize(6)))
			.andExpect(jsonPath("$.nutrition", hasSize(5)));
		as(principalA, get("/api/v1/reports/dashboard"), schoolB.getId()).andExpect(status().isForbidden());
		as(principalB, get("/api/v1/reports/dashboard"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.schools[0].children").value(0));
	}

	@Test
	void ownerComparesSchoolsAndAccountantSeesFinanceOnly() throws Exception {
		as(owner, get("/api/v1/reports/dashboard")).andExpect(status().isOk())
			.andExpect(jsonPath("$.chainView").value(true))
			.andExpect(jsonPath("$.schools[?(@.schoolId=='%s')].children".formatted(schoolA.getId())).value(2));
		as(accountantA, get("/api/v1/reports/dashboard"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.showOperations").value(false))
			.andExpect(jsonPath("$.showFinance").value(true))
			.andExpect(jsonPath("$.schools[0].children").doesNotExist())
			.andExpect(jsonPath("$.schools[0].income", notNullValue()));
		as(teacher, get("/api/v1/reports/dashboard"), schoolA.getId()).andExpect(status().isForbidden());
	}

	@Test
	void exportsRespectScopeAndRole() throws Exception {
		byte[] a = as(principalA, get("/api/v1/reports/children/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsByteArray();
		assertThat(names(a)).containsExactly("Ánh", "Bảo");
		byte[] b = as(principalB, get("/api/v1/reports/children/export?month=2026-09"), schoolB.getId())
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsByteArray();
		assertThat(names(b)).isEmpty();

		User vice = data.vicePrincipal(schoolA, FunctionGroup.REPORTS);
		as(vice, get("/api/v1/reports/payroll/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isForbidden());
		as(vice, get("/api/v1/reports/dashboard"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.showOperations").value(true))
			.andExpect(jsonPath("$.showFinance").value(false));
		as(principalA, get("/api/v1/reports/payroll/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isOk());
		as(accountantA, get("/api/v1/reports/payroll/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isOk());
		as(accountantA, get("/api/v1/reports/receivables/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isOk());
		as(accountantA, get("/api/v1/reports/children/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isForbidden());
		as(teacher, get("/api/v1/reports/receivables/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isForbidden());
		as(principalA, get("/api/v1/reports/unknown/export?month=2026-09"), schoolA.getId())
			.andExpect(status().isNotFound());
		as(principalA, get("/api/v1/reports/children/export?month=09-2026"), schoolA.getId())
			.andExpect(status().isBadRequest());
	}

	/** Cột "Họ tên" (cột 4) của danh sách trẻ, bỏ dòng tiêu đề. */
	private static List<String> names(byte[] xlsx) throws Exception {
		List<String> out = new ArrayList<>();
		try (XSSFWorkbook book = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
			for (Row row : book.getSheetAt(0)) {
				if (row.getRowNum() >= 3) {
					out.add(row.getCell(3).getStringCellValue());
				}
			}
		}
		return out;
	}

}
