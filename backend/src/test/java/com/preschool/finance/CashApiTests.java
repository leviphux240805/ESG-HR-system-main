package com.preschool.finance;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.finance.entity.CashCategory;
import com.preschool.finance.repository.CashCategoryRepository;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Sổ thu chi: kế toán nhập/sửa/xóa khoản tay ở cơ sở mình; cơ sở B không xem/sửa của cơ sở A; hiệu trưởng chỉ xem;
 * giáo viên không xem; danh mục chung do kế toán cấp chuỗi quản lý, danh mục hệ thống không sửa được.
 */
class CashApiTests extends ApiTestSupport {

	@Autowired
	CashCategoryRepository categories;

	School schoolA;

	School schoolB;

	User accountantA;

	User accountantB;

	User principalA;

	User teacherA;

	User principalAB;

	User viceA;

	String food;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		accountantB = data.user(RoleCode.ACCOUNTANT, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		teacherA = data.user(RoleCode.TEACHER, schoolA);
		principalAB = data.principal(schoolA, schoolB);
		viceA = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM);
		food = categories.findAll()
			.stream()
			.filter(c -> c.getName().equals("Thực phẩm"))
			.findFirst()
			.orElseThrow()
			.getId()
			.toString();
	}

	private ResultActions create(User user, School school, String categoryId, long amount) throws Exception {
		return as(user, post("/api/v1/cash-entries").contentType(MediaType.APPLICATION_JSON).content("""
				{"categoryId":"%s","amount":%d,"entryDate":"2026-09-05","description":"Mua rau chợ Bến Thành"}"""
			.formatted(categoryId, amount)), school.getId());
	}

	@Test
	void accountantRecordsManualEntriesOnlyInOwnSchool() throws Exception {
		String id = JsonPath.read(create(accountantA, schoolA, food, 450_000).andExpect(status().isCreated())
			.andExpect(jsonPath("$.direction").value("OUT"))
			.andExpect(jsonPath("$.source").value("MANUAL"))
			.andExpect(jsonPath("$.categoryName").value("Thực phẩm"))
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.id");

		as(accountantA, put("/api/v1/cash-entries/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"categoryId":"%s","amount":500000,"entryDate":"2026-09-06","description":"Mua rau"}""".formatted(food)),
				schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.amount").value(500_000));
		as(principalA, get("/api/v1/cash-entries").param("from", "2026-09-01").param("to", "2026-09-30"),
				schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(1));
		as(principalA, get("/api/v1/cash-entries/summary").param("from", "2026-09-01").param("to", "2026-09-30"),
				schoolA.getId())
			.andExpect(jsonPath("$.totalOut").value(500_000))
			.andExpect(jsonPath("$.net").value(-500_000))
			.andExpect(jsonPath("$.byCategory[0].categoryName").value("Thực phẩm"));
		as(accountantA, get("/api/v1/cash-entries").param("direction", "IN"), schoolA.getId())
			.andExpect(jsonPath("$.totalElements").value(0));

		create(viceA, schoolA, food, 1).andExpect(status().isForbidden());
		as(viceA, delete("/api/v1/cash-entries/" + id), schoolA.getId()).andExpect(status().isNotFound());
		as(teacherA, get("/api/v1/cash-entries"), schoolA.getId()).andExpect(status().isForbidden());
		create(accountantB, schoolA, food, 1).andExpect(status().isForbidden());
		as(accountantB, get("/api/v1/cash-entries"), schoolB.getId()).andExpect(jsonPath("$.totalElements").value(0));
		as(accountantB, put("/api/v1/cash-entries/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"categoryId":"%s","amount":1,"entryDate":"2026-09-06","description":"x"}""".formatted(food)),
				schoolB.getId())
			.andExpect(status().isNotFound());
		as(accountantB, delete("/api/v1/cash-entries/" + id), schoolB.getId()).andExpect(status().isNotFound());

		as(accountantA, delete("/api/v1/cash-entries/" + id), schoolA.getId()).andExpect(status().isNoContent());
		as(accountantA, get("/api/v1/cash-entries"), schoolA.getId()).andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void manualEntriesRejectSystemCategoriesAndInvalidInput() throws Exception {
		String tuition = categories.findBySystemCode(CashCategory.TUITION).orElseThrow().getId().toString();
		create(accountantA, schoolA, tuition, 100_000).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("categoryId"));
		create(accountantA, schoolA, food, 0).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("amount"));
		as(accountantA, post("/api/v1/cash-entries").contentType(MediaType.APPLICATION_JSON).content("""
				{"categoryId":"%s","amount":1000,"entryDate":"2026-09-05","description":"x"}""".formatted(food)))
			.andExpect(status().isBadRequest());
	}

	@Test
	void principalManagesCategories() throws Exception {
		String name = "Quảng cáo " + UUID.randomUUID().toString().substring(0, 6);
		String body = """
				{"direction":"OUT","name":"%s","orderNo":50}""".formatted(name);
		as(accountantA, post("/api/v1/cash-categories").contentType(MediaType.APPLICATION_JSON).content(body),
				schoolA.getId())
			.andExpect(status().isForbidden());
		String id = JsonPath.read(as(principalAB,
				post("/api/v1/cash-categories").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.system").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.id");
		as(principalAB, post("/api/v1/cash-categories").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isConflict());
		as(principalAB, put("/api/v1/cash-categories/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"%s","active":false,"orderNo":50}""".formatted(name)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
		create(accountantA, schoolA, id, 1000).andExpect(status().isBadRequest());

		String tuition = categories.findBySystemCode(CashCategory.TUITION).orElseThrow().getId().toString();
		as(principalAB, put("/api/v1/cash-categories/" + tuition).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"name":"Học phí","active":true,"orderNo":1}"""))
			.andExpect(status().isConflict());
		as(principalA, get("/api/v1/cash-categories"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.name == 'Thu học phí')].system").value(org.hamcrest.Matchers.hasItem(true)));
		as(teacherA, get("/api/v1/cash-categories"), schoolA.getId()).andExpect(status().isForbidden());
	}

}
