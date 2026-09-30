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
import org.springframework.test.web.servlet.ResultActions;

/** Quản lý tài khoản: chỉ cấp chuỗi; chặn tự khóa, chủ chuỗi cuối cùng, nâng quyền chủ chuỗi. */
class AccountAdminTests extends ApiTestSupport {

	@Autowired
	UserRepository userRepo;

	School schoolA;

	School schoolB;

	User admin;

	User owner;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		admin = data.user(RoleCode.CHAIN_ADMIN, null);
		owner = data.user(RoleCode.OWNER, null);
	}

	@Test
	void onlyChainManagersCanManageAccounts() throws Exception {
		User principal = data.user(RoleCode.PRINCIPAL, schoolA);
		User accountant = data.user(RoleCode.ACCOUNTANT, null);
		as(principal, get("/api/v1/accounts")).andExpect(status().isForbidden());
		as(accountant, get("/api/v1/accounts")).andExpect(status().isForbidden());
		create(principal, email(), null, "[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"}]".formatted(schoolA.getId()))
			.andExpect(status().isForbidden());
		as(principal, post("/api/v1/accounts/" + admin.getId() + "/lock")).andExpect(status().isForbidden());
	}

	@Test
	void createLinkedAccountAndValidateRolesAndDuplicates() throws Exception {
		Staff staff = data.staff(schoolA, Position.TEACHER);
		String email = email();
		String id = JsonPath.read(create(admin, email, staff.getId(), "[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"}]"
			.formatted(schoolA.getId()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.fullName").value(staff.getFullName()))
			.andExpect(jsonPath("$.staffCode").value(staff.getStaffCode()))
			.andExpect(jsonPath("$.roles[0].role").value("TEACHER"))
			.andExpect(jsonPath("$.roles[0].schoolName").value(schoolA.getName()))
			.andReturn().getResponse().getContentAsString(), "$.id");

		create(admin, email(), staff.getId(), "[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"}]".formatted(schoolA.getId()))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].field").value("staffId"));
		create(admin, email, null, "[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"}]".formatted(schoolA.getId()))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].field").value("email"));
		create(admin, email(), null, "[{\"role\":\"PRINCIPAL\"}]").andExpect(status().isBadRequest());

		as(admin, get("/api/v1/accounts?q=" + email)).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", hasItem(id)));
		as(admin, get("/api/v1/accounts?role=TEACHER&schoolId=" + schoolB.getId()))
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));

		// Gán lại vai trò: giữ giáo viên A, thêm y tế B
		as(admin, put("/api/v1/accounts/" + id + "/roles").contentType(MediaType.APPLICATION_JSON)
			.content("{\"roles\":[{\"role\":\"TEACHER\",\"schoolId\":\"%s\"},{\"role\":\"NURSE\",\"schoolId\":\"%s\"}]}"
				.formatted(schoolA.getId(), schoolB.getId())))
			.andExpect(status().isOk()).andExpect(jsonPath("$.roles.length()").value(2));
		as(admin, get("/api/v1/accounts?role=NURSE&schoolId=" + schoolB.getId()))
			.andExpect(jsonPath("$.items[*].id", hasItem(id)));
	}

	@Test
	void onlyOwnerGrantsOwnerRole() throws Exception {
		User target = data.user(RoleCode.TEACHER, schoolA);
		String ownerRoles = "{\"roles\":[{\"role\":\"OWNER\"}]}";
		as(admin, put("/api/v1/accounts/" + target.getId() + "/roles").contentType(MediaType.APPLICATION_JSON)
			.content(ownerRoles)).andExpect(status().isForbidden());
		create(admin, email(), null, "[{\"role\":\"OWNER\"}]").andExpect(status().isForbidden());
		as(owner, put("/api/v1/accounts/" + target.getId() + "/roles").contentType(MediaType.APPLICATION_JSON)
			.content(ownerRoles)).andExpect(status().isOk());
		as(admin, post("/api/v1/accounts/" + target.getId() + "/lock")).andExpect(status().isForbidden());
	}

	@Test
	void lockRevokesLoginAndSelfLockIsBlocked() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);
		as(admin, post("/api/v1/accounts/" + admin.getId() + "/lock")).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("SELF_LOCK"));
		as(admin, post("/api/v1/accounts/" + teacher.getId() + "/lock")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"%s\",\"password\":\"%s\"}".formatted(teacher.getEmail(), TestData.PASSWORD)))
			.andExpect(status().is4xxClientError());
		as(admin, post("/api/v1/accounts/" + teacher.getId() + "/send-reset")).andExpect(status().isConflict());
		as(admin, post("/api/v1/accounts/" + teacher.getId() + "/unlock")).andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));
		login(teacher.getEmail(), false);
		as(admin, post("/api/v1/accounts/" + teacher.getId() + "/send-reset")).andExpect(status().isAccepted());
	}

	@Test
	void lastOwnerKeepsOwnerRole() throws Exception {
		// Chỉ còn một chủ chuỗi đang hoạt động
		userRepo.findActiveByRole(RoleCode.OWNER, null).stream().filter(u -> !u.getId().equals(owner.getId()))
			.forEach(data::deactivate);
		as(owner, put("/api/v1/accounts/" + owner.getId() + "/roles").contentType(MediaType.APPLICATION_JSON)
			.content("{\"roles\":[{\"role\":\"CHAIN_ADMIN\"}]}"))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_OWNER"));
		User secondOwner = data.user(RoleCode.OWNER, null);
		as(secondOwner, post("/api/v1/accounts/" + owner.getId() + "/lock")).andExpect(status().isOk());
		as(secondOwner, post("/api/v1/accounts/" + owner.getId() + "/unlock")).andExpect(status().isOk());
	}

	private static String email() {
		return "tk." + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
	}

	private ResultActions create(User user, String email, UUID staffId, String roles) throws Exception {
		String staff = staffId == null ? "" : ",\"staffId\":\"%s\"".formatted(staffId);
		String name = staffId == null ? ",\"fullName\":\"Người Thử\"" : "";
		return as(user, post("/api/v1/accounts").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"%s\"%s%s,\"roles\":%s}".formatted(email, name, staff, roles)));
	}

}
