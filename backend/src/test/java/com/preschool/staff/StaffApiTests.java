package com.preschool.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/** Hồ sơ nhân viên: chặn chéo cơ sở và phân quyền theo vai trò (test bắt buộc giai đoạn 2). */
class StaffApiTests extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	School schoolA;

	School schoolB;

	Staff staffA;

	Staff staffB;

	@BeforeEach
	void setUpStaff() {
		schoolA = data.school();
		schoolB = data.school();
		staffA = data.staff(schoolA, Position.TEACHER);
		staffB = data.staff(schoolB, Position.TEACHER);
	}

	@Test
	void principalOfSchoolADoesNotSeeStaffOfSchoolB() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);

		as(principalA, get("/api/v1/staff?size=100")).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", hasItem(staffA.getId().toString())))
			.andExpect(jsonPath("$.items[*].id", not(hasItem(staffB.getId().toString()))))
			.andExpect(jsonPath("$.items[*].schoolId", everyItem(is(schoolA.getId().toString()))));
		as(principalA, get("/api/v1/staff/" + staffB.getId())).andExpect(status().isNotFound());
		as(principalA, put("/api/v1/staff/" + staffB.getId()).contentType(MediaType.APPLICATION_JSON)
			.content(fieldsJson("Sửa trái phép", null))).andExpect(status().isNotFound());
		as(principalA, get("/api/v1/staff?schoolId=" + schoolB.getId())).andExpect(status().isForbidden());
	}

	@Test
	void teacherSeesOnlyOwnProfile() throws Exception {
		User teacher = data.userForStaff(RoleCode.TEACHER, schoolA, staffA);
		Staff colleague = data.staff(schoolA, Position.NANNY);

		as(teacher, get("/api/v1/staff/" + staffA.getId())).andExpect(status().isOk())
			.andExpect(jsonPath("$.permissions.isSelf").value(true))
			.andExpect(jsonPath("$.permissions.canEdit").value(false));
		as(teacher, get("/api/v1/staff/" + colleague.getId())).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("STAFF_FORBIDDEN"));
		as(teacher, get("/api/v1/staff")).andExpect(status().isForbidden());
	}

	@Test
	void principalSeesSalaryAndTransfers() throws Exception {
		jdbc.update("UPDATE staff SET bank_account_no = '999888777' WHERE id = ?", staffA.getId());
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);

		as(principalA, get("/api/v1/staff/" + staffA.getId())).andExpect(status().isOk())
			.andExpect(jsonPath("$.bank.bankAccountNo").value("999888777"))
			.andExpect(jsonPath("$.permissions.canViewSalary").value(true))
			.andExpect(jsonPath("$.permissions.canManageSalary").value(true))
			.andExpect(jsonPath("$.permissions.canTransfer").value(true));
	}

	@Test
	void hrVicePrincipalEditsOwnSchoolButCannotSeeBankOrSalary() throws Exception {
		jdbc.update("UPDATE staff SET bank_account_no = '999888777' WHERE id = ?", staffA.getId());
		User principalA = data.vicePrincipal(schoolA, FunctionGroup.HR);

		as(principalA, get("/api/v1/staff/" + staffA.getId())).andExpect(status().isOk())
			.andExpect(jsonPath("$.bank").doesNotExist())
			.andExpect(jsonPath("$.permissions.canViewSalary").value(false))
			.andExpect(jsonPath("$.permissions.canEdit").value(true))
			.andExpect(jsonPath("$.permissions.canTerminate").value(true))
			.andExpect(jsonPath("$.permissions.canTransfer").value(false));

		as(principalA, put("/api/v1/staff/" + staffA.getId()).contentType(MediaType.APPLICATION_JSON)
			.content(fieldsJson("Tên đã sửa", null))).andExpect(status().isOk())
			.andExpect(jsonPath("$.fullName").value("Tên đã sửa"));
		assertThat(jdbc.queryForObject(
				"SELECT count(*) FROM audit_logs WHERE entity = 'staff' AND entity_id = ? AND action = 'UPDATE'",
				Integer.class, staffA.getId())).isEqualTo(1);
	}

	@Test
	void accountantReadsWithBankButCannotEdit() throws Exception {
		jdbc.update("UPDATE staff SET bank_account_no = '999888777' WHERE id = ?", staffA.getId());
		User accountant = data.user(RoleCode.ACCOUNTANT, schoolA);

		as(accountant, get("/api/v1/staff/" + staffA.getId())).andExpect(status().isOk())
			.andExpect(jsonPath("$.bank.bankAccountNo").value("999888777"));
		as(accountant, put("/api/v1/staff/" + staffA.getId()).contentType(MediaType.APPLICATION_JSON)
			.content(fieldsJson("Kế toán sửa", null))).andExpect(status().isForbidden());
	}

	@Test
	void principalCreatesStaffOnlyInOwnSchool() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		String citizenId = TestData.randomDigits(12);

		String body = as(principalA, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(createJson(null, "Người Mới Tuyển", citizenId, null))).andExpect(status().isCreated())
			.andExpect(jsonPath("$.staffCode").value(org.hamcrest.Matchers.matchesPattern("NV\\d{4,}")))
			.andExpect(jsonPath("$.schoolId").value(schoolA.getId().toString()))
			.andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(body, "$.id");
		assertThat(jdbc.queryForObject("SELECT count(*) FROM staff_school_assignments WHERE staff_id = ?::uuid",
				Integer.class, id)).isEqualTo(1);

		as(principalA, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(createJson(schoolB.getId(), "Tuyển sang B", TestData.randomDigits(12), null)))
			.andExpect(status().isForbidden());
	}

	@Test
	void duplicateCitizenIdIsBlockedAcrossSchools() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);

		as(principalA, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(createJson(null, "Trùng CCCD", staffB.getCitizenId(), null))).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("STAFF_DUPLICATE"))
			.andExpect(jsonPath("$.errors[0].field").value("citizenId"));
		as(principalA, post("/api/v1/staff/check-duplicates").contentType(MediaType.APPLICATION_JSON)
			.content("{\"citizenId\":\"%s\",\"phone\":\"%s\"}".formatted(staffB.getCitizenId(), "0000000000")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.duplicates[0].field").value("citizenId"))
			.andExpect(jsonPath("$.duplicates.length()").value(1));
	}

	@Test
	void machineCodeIsNormalizedAndUniqueWithinSchoolOnly() throws Exception {
		User admin = data.principal(schoolA, schoolB);
		String code = "m" + TestData.randomDigits(5);
		jdbc.update("UPDATE staff SET machine_code = ? WHERE id = ?", code.toUpperCase(), staffA.getId());

		// Cùng mã ở cơ sở khác được phép; mã được viết hoa
		String json = """
				{"schoolId":"%s","fields":{"fullName":"Mã Máy","position":"TEACHER","startDate":"2024-09-01","machineCode":"%s"}}""";
		as(admin, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(json.formatted(schoolB.getId(), code))).andExpect(status().isCreated())
			.andExpect(jsonPath("$.machineCode").value(code.toUpperCase()));
		as(admin, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(json.formatted(schoolA.getId(), code))).andExpect(status().isConflict())
			.andExpect(jsonPath("$.errors[0].field").value("machineCode"));
		as(admin, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(json.formatted(schoolA.getId(), "mã có dấu"))).andExpect(status().isBadRequest());
	}

	@Test
	void onlyPrincipalsCreateLoginAccounts() throws Exception {
		User principalA = data.vicePrincipal(schoolA, FunctionGroup.HR);
		User admin = data.principal(schoolA, schoolB);
		String account = "{\"roles\":[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"}]}".formatted(schoolA.getId());
		String email = "moi." + UUID.randomUUID().toString().substring(0, 8) + "@test.local";

		as(principalA, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(createJson(schoolA.getId(), "Có tài khoản", TestData.randomDigits(12), account)))
			.andExpect(status().isForbidden());

		String body = as(admin, post("/api/v1/staff").contentType(MediaType.APPLICATION_JSON)
			.content(createJson(schoolA.getId(), "Có tài khoản", TestData.randomDigits(12), account)
				.replace("\"email\":null", "\"email\":\"" + email + "\"")))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.account.email").value(email))
			.andExpect(jsonPath("$.account.roles[0]").value("TEACHER"))
			.andReturn().getResponse().getContentAsString();
		String staffId = JsonPath.read(body, "$.id");
		assertThat(users.findByEmail(email).orElseThrow().getStaffId().toString()).isEqualTo(staffId);
	}

	@Test
	void summaryCountsOnlyVisibleStaff() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		User owner = data.principal(schoolA, schoolB);

		int teachersA = JsonPath.read(as(principalA, get("/api/v1/staff/summary")).andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(), "$.byPosition.TEACHER");
		int teachersAll = JsonPath.read(as(owner, get("/api/v1/staff/summary")).andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString(), "$.byPosition.TEACHER");
		assertThat(teachersAll).isGreaterThan(teachersA);

		int teachersAViaOwner = JsonPath.read(as(owner, get("/api/v1/staff/summary"), schoolA.getId())
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.byPosition.TEACHER");
		assertThat(teachersAViaOwner).isEqualTo(teachersA);
	}

	@Test
	void searchAndInvalidSort() throws Exception {
		User owner = data.principal(schoolA, schoolB);
		as(owner, get("/api/v1/staff?q=" + staffA.getStaffCode())).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[0].id").value(staffA.getId().toString()))
			.andExpect(jsonPath("$.totalElements").value(1));
		as(owner, get("/api/v1/staff?sort=bankAccountNo,asc")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("SORT_INVALID"));
	}

	private static String fieldsJson(String name, String email) {
		return """
				{"fullName":"%s","position":"TEACHER","startDate":"2024-08-01","email":%s}"""
			.formatted(name, email == null ? "null" : "\"" + email + "\"");
	}

	private static String createJson(UUID schoolId, String name, String citizenId, String accountJson) {
		return """
				{"schoolId":%s,"fields":{"fullName":"%s","position":"TEACHER","startDate":"2024-09-01",
				 "citizenId":"%s","gender":"FEMALE","email":null},"account":%s}"""
			.formatted(schoolId == null ? "null" : "\"" + schoolId + "\"", name, citizenId,
					accountJson == null ? "null" : accountJson);
	}

}
