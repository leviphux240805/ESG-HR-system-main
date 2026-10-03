package com.preschool.school;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Trường: hiệu trưởng tạo trường (tự thành hiệu trưởng của trường mới), sửa, ngừng; không thấy, không sửa được trường
 * của hiệu trưởng khác (kể cả khác tổ chức); phó hiệu trưởng không tạo, không sửa trường.
 */
class SchoolApiTests extends ApiTestSupport {

	School schoolA;

	School schoolB;

	User principal;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		principal = data.principal(schoolA, schoolB);
	}

	private ResultActions create(User user, String code) throws Exception {
		return as(user, post("/api/v1/schools").contentType(MediaType.APPLICATION_JSON).content("""
				{"code":"%s","name":"Trường %s","phone":"0241234567"}""".formatted(code, code)));
	}

	private static String code() {
		return "N" + UUID.randomUUID().toString().substring(0, 8);
	}

	@Test
	void principalCreatesSchoolAndBecomesItsPrincipal() throws Exception {
		String code = code();
		String id = JsonPath.read(create(principal, code).andExpect(status().isCreated())
			.andExpect(jsonPath("$.canEdit").value(true))
			.andExpect(jsonPath("$.type").value("MAIN"))
			.andReturn().getResponse().getContentAsString(), "$.id");

		as(principal, get("/api/v1/me")).andExpect(jsonPath("$.schools", hasSize(3)))
			.andExpect(jsonPath("$.schools[*].id", hasItem(id)));
		as(principal, get("/api/v1/children"), UUID.fromString(id)).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(0));
		create(principal, code).andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].field").value("code"));

		as(principal, put("/api/v1/schools/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"code":"%s","name":"Tên mới"}""".formatted(code))).andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Tên mới"));
		as(principal, post("/api/v1/schools/" + id + "/deactivate")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
		as(principal, get("/api/v1/me")).andExpect(jsonPath("$.schools[*].id", not(hasItem(id))));
		as(principal, get("/api/v1/schools")).andExpect(jsonPath("$[?(@.id=='%s')].active".formatted(id)).value(false));
		as(principal, post("/api/v1/schools/" + id + "/activate")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));
	}

	@Test
	void lastActiveSchoolCannotBeDeactivated() throws Exception {
		User single = data.principal(schoolA);
		as(single, post("/api/v1/schools/" + schoolA.getId() + "/deactivate")).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LAST_SCHOOL"));
	}

	@Test
	void principalCannotSeeOrEditOtherPrincipalsSchools() throws Exception {
		School otherSameOrg = data.school();
		data.principal(otherSameOrg);
		School foreign = data.school(data.organization());
		User foreignPrincipal = data.principal(foreign);

		as(principal, get("/api/v1/schools")).andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[*].id", not(hasItem(otherSameOrg.getId().toString()))))
			.andExpect(jsonPath("$[*].id", not(hasItem(foreign.getId().toString()))));
		as(principal, put("/api/v1/schools/" + otherSameOrg.getId()).contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"X1\",\"name\":\"Chiếm\"}")).andExpect(status().isNotFound());
		as(principal, post("/api/v1/schools/" + foreign.getId() + "/deactivate")).andExpect(status().isNotFound());
		as(principal, get("/api/v1/children"), foreign.getId()).andExpect(status().isForbidden());

		as(foreignPrincipal, get("/api/v1/schools")).andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].id").value(foreign.getId().toString()));
		as(foreignPrincipal, get("/api/v1/children"), schoolA.getId()).andExpect(status().isForbidden());
		as(foreignPrincipal, get("/api/v1/accounts?size=100")).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(principal.getId().toString()))));
	}

	@Test
	void vicePrincipalCannotCreateOrEditSchools() throws Exception {
		User vice = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM, FunctionGroup.HR);
		create(vice, code()).andExpect(status().isForbidden());
		as(vice, put("/api/v1/schools/" + schoolA.getId()).contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"X2\",\"name\":\"Đổi\"}")).andExpect(status().isForbidden());
		as(vice, get("/api/v1/schools")).andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].canEdit").value(false));
	}

	@Test
	void vicePrincipalStaysInsideSchoolAndFunctionGroups() throws Exception {
		User vice = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM);
		as(vice, get("/api/v1/classes"), schoolA.getId()).andExpect(status().isOk());
		as(vice, get("/api/v1/classes"), schoolB.getId()).andExpect(status().isForbidden());
		as(vice, get("/api/v1/invoices?month=2026-09-01"), schoolA.getId()).andExpect(status().isForbidden());
		as(vice, get("/api/v1/staff"), schoolA.getId()).andExpect(status().isForbidden());
		as(vice, get("/api/v1/reports/dashboard"), schoolA.getId()).andExpect(status().isForbidden());
		as(vice, get("/api/v1/accounts"), schoolA.getId()).andExpect(status().isForbidden());
	}

}
