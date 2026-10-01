package com.preschool.account;

import static org.hamcrest.Matchers.hasItem;
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
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Quản lý tài khoản: chỉ hiệu trưởng, trong các trường mình làm hiệu trưởng; không gán vai trò hiệu trưởng, không sửa
 * hay khóa tài khoản hiệu trưởng; vai trò ở trường khác được giữ nguyên; chặn tự khóa.
 */
class AccountAdminTests extends ApiTestSupport {

	School schoolA;

	School schoolB;

	School otherSchool;

	User principal;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		otherSchool = data.school();
		principal = data.principal(schoolA, schoolB);
	}

	@Test
	void onlyPrincipalsManageAccounts() throws Exception {
		User vice = data.vicePrincipal(schoolA, FunctionGroup.HR, FunctionGroup.CLASSROOM);
		User accountant = data.user(RoleCode.ACCOUNTANT, schoolA);
		as(vice, get("/api/v1/accounts")).andExpect(status().isForbidden());
		as(accountant, get("/api/v1/accounts")).andExpect(status().isForbidden());
		create(vice, email(), null, roles("TEACHER", schoolA)).andExpect(status().isForbidden());
		as(vice, post("/api/v1/accounts/" + accountant.getId() + "/lock")).andExpect(status().isForbidden());
	}

	@Test
	void createLinkedAccountAndValidateRolesAndDuplicates() throws Exception {
		Staff staff = data.staff(schoolA, Position.TEACHER);
		String email = email();
		String id = JsonPath.read(create(principal, email, staff.getId(), roles("TEACHER", schoolA))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.fullName").value(staff.getFullName()))
			.andExpect(jsonPath("$.staffCode").value(staff.getStaffCode()))
			.andExpect(jsonPath("$.roles[0].role").value("TEACHER"))
			.andExpect(jsonPath("$.roles[0].schoolName").value(schoolA.getName()))
			.andExpect(jsonPath("$.roles[0].editable").value(true))
			.andReturn().getResponse().getContentAsString(), "$.id");

		create(principal, email(), staff.getId(), roles("TEACHER", schoolA))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].field").value("staffId"));
		create(principal, email, null, roles("TEACHER", schoolA))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].field").value("email"));
		create(principal, email(), null, "[{\"role\":\"TEACHER\"}]").andExpect(status().isBadRequest());

		as(principal, get("/api/v1/accounts?q=" + email)).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", hasItem(id)));
		as(principal, get("/api/v1/accounts?role=TEACHER&schoolId=" + schoolB.getId()))
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));

		// Gán lại vai trò: giữ giáo viên A, thêm y tế B
		updateRoles(principal, id, "[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"},{\"role\":\"NURSE\",\"schoolId\":\"%s\"}]"
			.formatted(schoolA.getId(), schoolB.getId()))
			.andExpect(status().isOk()).andExpect(jsonPath("$.roles.length()").value(2));
		as(principal, get("/api/v1/accounts?role=NURSE&schoolId=" + schoolB.getId()))
			.andExpect(jsonPath("$.items[*].id", hasItem(id)));
	}

	@Test
	void principalRoleIsReservedForOperator() throws Exception {
		User target = data.user(RoleCode.TEACHER, schoolA);
		updateRoles(principal, target.getId().toString(), roles("PRINCIPAL", schoolA)).andExpect(status().isForbidden());
		create(principal, email(), null, roles("PRINCIPAL", schoolA)).andExpect(status().isForbidden());

		User coPrincipal = data.principal(schoolA);
		updateRoles(principal, coPrincipal.getId().toString(), roles("TEACHER", schoolA))
			.andExpect(status().isForbidden());
		as(principal, post("/api/v1/accounts/" + coPrincipal.getId() + "/lock")).andExpect(status().isForbidden());
	}

	@Test
	void vicePrincipalNeedsFunctionGroups() throws Exception {
		create(principal, email(), null, roles("VICE_PRINCIPAL", schoolA)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("FUNCTION_GROUP_REQUIRED"));
		create(principal, email(), null, "[{\"role\":\"VICE_PRINCIPAL\",\"schoolId\":\"%s\",\"functionGroups\":[\"HR\",\"REPORTS\"]}]"
			.formatted(schoolA.getId()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.roles[0].functionGroups.length()").value(2));
	}

	@Test
	void principalOnlyTouchesOwnSchools() throws Exception {
		User outsider = data.user(RoleCode.TEACHER, otherSchool);
		as(principal, get("/api/v1/accounts?size=100")).andExpect(jsonPath("$.items[*].id", not(hasItem(outsider.getId().toString()))));
		as(principal, post("/api/v1/accounts/" + outsider.getId() + "/lock")).andExpect(status().isNotFound());
		create(principal, email(), null, roles("TEACHER", otherSchool)).andExpect(status().isForbidden());

		// Vai trò ở trường hiệu trưởng không quản lý được giữ nguyên khi đổi vai trò
		User shared = data.user(RoleCode.TEACHER, schoolA, otherSchool);
		updateRoles(principal, shared.getId().toString(), roles("NURSE", schoolA)).andExpect(status().isOk())
			.andExpect(jsonPath("$.roles.length()").value(2))
			.andExpect(jsonPath("$.roles[?(@.schoolId=='%s')].role".formatted(otherSchool.getId())).value("TEACHER"))
			.andExpect(jsonPath("$.roles[?(@.schoolId=='%s')].editable".formatted(otherSchool.getId())).value(false));
	}

	@Test
	void lockRevokesLoginAndSelfLockIsBlocked() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);
		as(principal, post("/api/v1/accounts/" + principal.getId() + "/lock")).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("SELF_LOCK"));
		as(principal, post("/api/v1/accounts/" + teacher.getId() + "/lock")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"%s\",\"password\":\"%s\"}".formatted(teacher.getEmail(), TestData.PASSWORD)))
			.andExpect(status().is4xxClientError());
		as(principal, post("/api/v1/accounts/" + teacher.getId() + "/send-reset")).andExpect(status().isConflict());
		as(principal, post("/api/v1/accounts/" + teacher.getId() + "/unlock")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));
		login(teacher.getEmail(), false);
		as(principal, post("/api/v1/accounts/" + teacher.getId() + "/send-reset")).andExpect(status().isAccepted());
	}

	private static String email() {
		return "tk." + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
	}

	private static String roles(String role, School school) {
		return "[{\"role\":\"%s\",\"schoolId\":\"%s\"}]".formatted(role, school.getId());
	}

	private ResultActions updateRoles(User user, String id, String roles) throws Exception {
		return as(user, put("/api/v1/accounts/" + id + "/roles").contentType(MediaType.APPLICATION_JSON)
			.content("{\"roles\":" + roles + "}"));
	}

	private ResultActions create(User user, String email, UUID staffId, String roles) throws Exception {
		String staff = staffId == null ? "" : ",\"staffId\":\"%s\"".formatted(staffId);
		String name = staffId == null ? ",\"fullName\":\"Người Thử\"" : "";
		return as(user, post("/api/v1/accounts").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"%s\"%s%s,\"roles\":%s}".formatted(email, name, staff, roles)));
	}

}
