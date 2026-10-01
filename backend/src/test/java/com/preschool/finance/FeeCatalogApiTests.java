package com.preschool.finance;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.finance.repository.FeeTypeRepository;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/**
 * Danh mục học phí: chỉ kế toán cấp chuỗi sửa khoản thu; biểu phí, khoản tự chọn, miễn giảm theo cơ sở (cơ sở B không
 * xem/sửa của cơ sở A); hiệu trưởng chỉ xem; giáo viên không xem được.
 */
class FeeCatalogApiTests extends ApiTestSupport {

	@Autowired
	FeeTypeRepository feeTypes;

	School schoolA;

	School schoolB;

	/** Hiệu trưởng: danh mục khoản thu và cấu hình chung của tổ chức. */
	User catalogPrincipal;

	User viceA;

	User accountantA;

	User accountantB;

	User principalA;

	User teacherA;

	String yearId;

	String childA;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		User admin = data.principal(schoolA, schoolB);
		catalogPrincipal = data.principal(schoolA, schoolB);
		viceA = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		accountantB = data.user(RoleCode.ACCOUNTANT, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		teacherA = data.user(RoleCode.TEACHER, schoolA);
		String year = as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"F%s","startDate":"2026-08-15","endDate":"2027-05-31"}"""
			.formatted(UUID.randomUUID().toString().substring(0, 8)))).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		yearId = JsonPath.read(year, "$.id");
		String child = as(principalA, post("/api/v1/children").contentType(MediaType.APPLICATION_JSON).content("""
				{"profile":{"fullName":"Phạm Minh Khang","dob":"2021-03-10","gender":"MALE"},
				"enrolledAt":"2026-09-01","guardians":[]}"""), schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		childA = JsonPath.read(child, "$.item.id");
	}

	private String feeTypeId(String code) {
		return feeTypes.findByCode(code).orElseThrow().getId().toString();
	}

	private String scheduleBody(String feeTypeCode, long amount, String from) {
		return """
				{"schoolYearId":"%s","feeTypeId":"%s","amount":%d,"effectiveFrom":"%s"}""".formatted(yearId,
				feeTypeId(feeTypeCode), amount, from);
	}

	@Test
	void onlyPrincipalManagesFeeTypes() throws Exception {
		String code = "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
		String body = """
				{"code":"%s","name":"Học bơi","calcMethod":"OPTIONAL","orderNo":9}""".formatted(code);
		as(accountantA, post("/api/v1/fee-types").contentType(MediaType.APPLICATION_JSON).content(body), schoolA.getId())
			.andExpect(status().isForbidden());
		String created = as(catalogPrincipal,
				post("/api/v1/fee-types").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.refundableOnAbsence").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		as(catalogPrincipal, post("/api/v1/fee-types").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.errors[0].field").value("code"));
		as(catalogPrincipal, put("/api/v1/fee-types/" + JsonPath.read(created, "$.id"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"name":"Học bơi nâng cao","active":false,"orderNo":9}""")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
		as(catalogPrincipal, post("/api/v1/fee-types").contentType(MediaType.APPLICATION_JSON).content("""
				{"code":"sai ma","name":"","calcMethod":"MONTHLY","orderNo":0}""")).andExpect(status().isBadRequest());

		as(principalA, get("/api/v1/fee-types"), schoolA.getId()).andExpect(status().isOk());
		as(teacherA, get("/api/v1/fee-types"), schoolA.getId()).andExpect(status().isForbidden());
	}

	@Test
	void schedulesBelongToSelectedSchool() throws Exception {
		String created = as(accountantA, post("/api/v1/fee-schedules").contentType(MediaType.APPLICATION_JSON)
			.content(scheduleBody("HOC_PHI", 3_000_000, "2026-09-01")), schoolA.getId())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.feeTypeName").value("Học phí"))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String id = JsonPath.read(created, "$.id");
		as(accountantA, post("/api/v1/fee-schedules").contentType(MediaType.APPLICATION_JSON)
			.content(scheduleBody("HOC_PHI", 3_200_000, "2026-09-01")), schoolA.getId())
			.andExpect(status().isConflict());
		as(accountantA, post("/api/v1/fee-schedules").contentType(MediaType.APPLICATION_JSON)
			.content(scheduleBody("HOC_PHI", 3_200_000, "2027-01-01")), schoolA.getId())
			.andExpect(status().isCreated());
		as(accountantB, post("/api/v1/fee-schedules").contentType(MediaType.APPLICATION_JSON)
			.content(scheduleBody("TIEN_AN", 30_000, "2026-09-01")), schoolB.getId())
			.andExpect(status().isCreated());

		as(principalA, get("/api/v1/fee-schedules").param("schoolYearId", yearId), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].effectiveFrom").value("2027-01-01"));
		as(accountantB, get("/api/v1/fee-schedules"), schoolA.getId()).andExpect(status().isForbidden());
		as(accountantB, get("/api/v1/fee-schedules").param("schoolYearId", yearId), schoolB.getId())
			.andExpect(jsonPath("$", hasSize(1)));

		as(viceA, post("/api/v1/fee-schedules").contentType(MediaType.APPLICATION_JSON)
			.content(scheduleBody("TIEN_AN", 30_000, "2026-09-01")), schoolA.getId())
			.andExpect(status().isForbidden());
		as(accountantB, delete("/api/v1/fee-schedules/" + id), schoolB.getId()).andExpect(status().isNotFound());
		as(accountantA, delete("/api/v1/fee-schedules/" + id), schoolA.getId()).andExpect(status().isNoContent());
	}

	@Test
	void childFeeItemsAndDiscountsAreScopedToChildSchool() throws Exception {
		as(accountantA, post("/api/v1/children/" + childA + "/fee-items").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"feeTypeId":"%s","fromMonth":"2026-09-01"}""".formatted(feeTypeId("HOC_PHI"))),
				schoolA.getId())
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("feeTypeId"));
		String item = as(accountantA, post("/api/v1/children/" + childA + "/fee-items")
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"feeTypeId":"%s","fromMonth":"2026-09-15","toMonth":"2026-12-20"}""".formatted(
					feeTypeId("NANG_KHIEU"))), schoolA.getId())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.fromMonth").value("2026-09-01"))
			.andExpect(jsonPath("$.toMonth").value("2026-12-01"))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String itemId = JsonPath.read(item, "$.id");

		as(accountantA, post("/api/v1/children/" + childA + "/discounts").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"percent":50,"amount":100000,"reason":"Con giáo viên","fromMonth":"2026-09-01"}"""),
				schoolA.getId())
			.andExpect(status().isBadRequest());
		as(accountantA, post("/api/v1/children/" + childA + "/discounts").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"feeTypeId":"%s","percent":50,"reason":"Con giáo viên","fromMonth":"2026-09-01",
					"toMonth":"2026-08-01"}""".formatted(feeTypeId("HOC_PHI"))), schoolA.getId())
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("toMonth"));
		as(accountantA, post("/api/v1/children/" + childA + "/discounts").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"feeTypeId":"%s","percent":50,"reason":"Con giáo viên","fromMonth":"2026-09-01"}"""
				.formatted(feeTypeId("HOC_PHI"))), schoolA.getId())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.percent").value(50));

		as(principalA, get("/api/v1/children/" + childA + "/discounts"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)));
		as(viceA, delete("/api/v1/children/" + childA + "/fee-items/" + itemId), schoolA.getId())
			.andExpect(status().isNotFound());
		as(accountantB, get("/api/v1/children/" + childA + "/fee-items"), schoolB.getId())
			.andExpect(status().isNotFound());
		as(accountantB, delete("/api/v1/children/" + childA + "/fee-items/" + itemId), schoolB.getId())
			.andExpect(status().isNotFound());
		as(teacherA, get("/api/v1/children/" + childA + "/discounts"), schoolA.getId())
			.andExpect(status().isNotFound());
		as(accountantA, delete("/api/v1/children/" + childA + "/fee-items/" + itemId), schoolA.getId())
			.andExpect(status().isNoContent());
	}

	@Test
	void configsBySchoolAndChain() throws Exception {
		as(principalA, get("/api/v1/finance/configs"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.schoolId == null)]").isNotEmpty());
		String body = """
				{"effectiveFrom":"2026-09-01","mealRefundRule":"ALL_EXCUSED","proration":"FULL_MONTH","dueDay":15}""";
		as(viceA, post("/api/v1/finance/configs").contentType(MediaType.APPLICATION_JSON).content(body),
				schoolA.getId())
			.andExpect(status().isForbidden());
		as(accountantA, post("/api/v1/finance/configs").contentType(MediaType.APPLICATION_JSON).content(body),
				schoolA.getId())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.schoolId").value(schoolA.getId().toString()));
		as(accountantA, post("/api/v1/finance/configs").contentType(MediaType.APPLICATION_JSON).content(body),
				schoolA.getId())
			.andExpect(status().isConflict());
		as(accountantA, post("/api/v1/finance/configs").contentType(MediaType.APPLICATION_JSON).content("""
				{"effectiveFrom":"2026-10-01","mealRefundRule":"NONE","proration":"FULL_MONTH","dueDay":31}"""),
				schoolA.getId())
			.andExpect(status().isBadRequest());
		as(accountantB, get("/api/v1/finance/configs"), schoolB.getId())
			.andExpect(jsonPath("$[?(@.schoolId == '%s')]".formatted(schoolA.getId())).isEmpty());

		String chain = """
				{"organizationWide":true,"effectiveFrom":"%s","mealRefundRule":"BEFORE_CUTOFF","proration":"BY_SCHOOL_DAYS",
				"dueDay":10}""".formatted(LocalDate.of(2001, 1, 1).plusDays(ThreadLocalRandom.current().nextInt(5000)));
		as(accountantA, post("/api/v1/finance/configs").contentType(MediaType.APPLICATION_JSON).content(chain),
				schoolA.getId())
			.andExpect(status().isForbidden());
		as(catalogPrincipal, post("/api/v1/finance/configs").contentType(MediaType.APPLICATION_JSON).content(chain))
			.andExpect(status().isCreated());
	}

}
