package com.preschool.classroom;

import static org.hamcrest.Matchers.hasSize;
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
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Năm học, khối, lớp, phân công giáo viên: hiệu trưởng chỉ quản lý lớp cơ sở mình, giáo viên chỉ thấy lớp được
 * phân công, vai trò chỉ xem không sửa được, cơ sở B không thấy lớp cơ sở A.
 */
class ClassroomApiTests extends ApiTestSupport {

	@Autowired
	AgeGroupRepository ageGroups;

	School schoolA;

	School schoolB;

	User admin;

	User principalA;

	User principalB;

	User accountantA;

	User staffA;

	Staff teacherStaff;

	User teacher;

	String yearId;

	String ageGroupId;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		admin = data.principal(schoolA, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		staffA = data.user(RoleCode.STAFF, schoolA);
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		yearId = createYear(admin).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		yearId = JsonPath.read(yearId, "$.id");
		ageGroupId = ageGroups.findByCode("MAU_GIAO_4_5").orElseThrow().getId().toString();
	}

	private ResultActions createYear(User user) throws Exception {
		String name = "T" + UUID.randomUUID().toString().substring(0, 8);
		return as(user, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"%s","startDate":"2026-08-15","endDate":"2027-05-31"}""".formatted(name)));
	}

	private ResultActions createClass(User user, School school, String name) throws Exception {
		return as(user, post("/api/v1/classes").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolYearId":"%s","ageGroupId":"%s","name":"%s","room":"P.101"}""".formatted(yearId, ageGroupId,
				name)), school.getId());
	}

	private String classId(User user, School school, String name) throws Exception {
		String body = createClass(user, school, name).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private ResultActions assign(User user, String classId, Staff staff, School school) throws Exception {
		return as(user, post("/api/v1/classes/" + classId + "/teachers").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"staffId":"%s","role":"MAIN","fromDate":"2026-09-01"}""".formatted(staff.getId())),
				school.getId());
	}

	@Test
	void principalCreatesClassWithAgeGroupCapacityAndOtherSchoolCannotSeeIt() throws Exception {
		createClass(principalA, schoolA, "Lá 1").andExpect(status().isCreated())
			.andExpect(jsonPath("$.capacity").value(30))
			.andExpect(jsonPath("$.ageGroupCode").value("MAU_GIAO_4_5"))
			.andExpect(jsonPath("$.size").value(0))
			.andExpect(jsonPath("$.canManage").value(true));
		String id = classId(principalA, schoolA, "Lá 2");

		as(principalA, get("/api/v1/classes").param("schoolYearId", yearId), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)));
		as(principalB, get("/api/v1/classes").param("schoolYearId", yearId), schoolB.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
		as(principalB, get("/api/v1/classes/" + id), schoolB.getId()).andExpect(status().isNotFound());
		as(principalB, put("/api/v1/classes/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"ageGroupId":"%s","name":"Đổi tên"}""".formatted(ageGroupId)), schoolB.getId())
			.andExpect(status().isNotFound());
		as(principalB, delete("/api/v1/classes/" + id), schoolB.getId()).andExpect(status().isNotFound());
		createClass(principalB, schoolA, "Lá 3").andExpect(status().isForbidden());
	}

	@Test
	void duplicateClassNameInSameYearIsRejected() throws Exception {
		classId(principalA, schoolA, "Chồi 1");
		createClass(principalA, schoolA, "Chồi 1").andExpect(status().isConflict())
			.andExpect(jsonPath("$.errors[0].field").value("name"));
		createClass(principalB, schoolB, "Chồi 1").andExpect(status().isCreated());
	}

	@Test
	void viewOnlyRolesCannotManageAndStaffCannotSeeClasses() throws Exception {
		String id = classId(principalA, schoolA, "Mầm 1");
		as(accountantA, get("/api/v1/classes/" + id), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.item.canManage").value(false));
		createClass(accountantA, schoolA, "Mầm 2").andExpect(status().isForbidden());
		as(accountantA, put("/api/v1/classes/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"ageGroupId":"%s","name":"Đổi tên"}""".formatted(ageGroupId)), schoolA.getId())
			.andExpect(status().isForbidden());
		as(staffA, get("/api/v1/classes"), schoolA.getId()).andExpect(status().isForbidden());
	}

	@Test
	void teacherSeesOnlyAssignedClasses() throws Exception {
		String mine = classId(principalA, schoolA, "Lá A");
		String other = classId(principalA, schoolA, "Lá B");
		assign(principalA, mine, teacherStaff, schoolA).andExpect(status().isCreated())
			.andExpect(jsonPath("$.item.teachers", hasSize(1)))
			.andExpect(jsonPath("$.item.teachers[0].staffId").value(teacherStaff.getId().toString()));

		as(teacher, get("/api/v1/classes").param("schoolYearId", yearId), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].id").value(mine))
			.andExpect(jsonPath("$[0].canManage").value(false));
		as(teacher, get("/api/v1/classes/" + other), schoolA.getId()).andExpect(status().isNotFound());
		createClass(teacher, schoolA, "Lá C").andExpect(status().isForbidden());
		assign(teacher, mine, teacherStaff, schoolA).andExpect(status().isForbidden());
	}

	@Test
	void assignmentRequiresStaffOfSameSchoolAndKeepsHistory() throws Exception {
		String id = classId(principalA, schoolA, "Nhà trẻ 1");
		Staff staffB = data.staff(schoolB, Position.TEACHER);
		assign(principalA, id, staffB, schoolA).andExpect(status().isBadRequest());

		String body = assign(principalA, id, teacherStaff, schoolA).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		assign(principalA, id, teacherStaff, schoolA).andExpect(status().isConflict());
		String assignmentId = JsonPath.read(body, "$.item.teachers[0].id");

		as(principalB, post("/api/v1/classes/" + id + "/teachers/" + assignmentId + "/end"), schoolB.getId())
			.andExpect(status().isNotFound());
		as(principalA, post("/api/v1/classes/" + id + "/teachers/" + assignmentId + "/end")
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"toDate\":\"2026-09-30\"}"), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.item.teachers", hasSize(0)))
			.andExpect(jsonPath("$.teacherHistory", hasSize(1)))
			.andExpect(jsonPath("$.teacherHistory[0].toDate").value("2026-09-30"));
		as(teacher, get("/api/v1/classes/" + id), schoolA.getId()).andExpect(status().isNotFound());
	}

	@Test
	void emptyClassCanBeDeleted() throws Exception {
		String id = classId(principalA, schoolA, "Tạm");
		as(principalA, delete("/api/v1/classes/" + id), schoolA.getId()).andExpect(status().isNoContent());
		as(principalA, get("/api/v1/classes/" + id), schoolA.getId()).andExpect(status().isNotFound());
	}

	@Test
	void onlyPrincipalsManageSchoolYearsAndAgeGroups() throws Exception {
		User vice = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM);
		createYear(vice).andExpect(status().isForbidden());
		String body = as(admin, get("/api/v1/school-years")).andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String name = JsonPath.read(body, "$[?(@.id == '" + yearId + "')].name").toString().replaceAll("[\\[\\]\"]", "");
		as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"%s","startDate":"2026-08-15","endDate":"2027-05-31"}""".formatted(name)))
			.andExpect(status().isConflict());
		as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"X%s","startDate":"2026-08-15","endDate":"2026-08-01"}""".formatted(name.substring(1))))
			.andExpect(status().isBadRequest());
		as(admin, post("/api/v1/school-years/" + yearId + "/current")).andExpect(status().isOk())
			.andExpect(jsonPath("$.current").value(true));
		as(vice, post("/api/v1/school-years/" + yearId + "/current"), schoolA.getId())
			.andExpect(status().isForbidden());

		as(vice, put("/api/v1/age-groups/" + ageGroupId).contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"Mẫu giáo 4–5 tuổi","minMonths":48,"maxMonths":60,"maxClassSize":30}"""), schoolA.getId())
			.andExpect(status().isForbidden());
		as(teacher, get("/api/v1/age-groups"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(4)));
	}

}
