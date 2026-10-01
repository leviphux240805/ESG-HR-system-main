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
import com.preschool.TestData;
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
 * Hồ sơ trẻ: cơ sở B không xem/sửa trẻ cơ sở A, giáo viên chỉ xem trẻ lớp mình, vai trò chỉ xem không sửa được,
 * chuyển lớp giữ lịch sử, nghỉ học đóng lớp, phụ huynh dùng chung cho anh chị em.
 */
class ChildrenApiTests extends ApiTestSupport {

	@Autowired
	AgeGroupRepository ageGroups;

	School schoolA;

	School schoolB;

	User principalA;

	User principalB;

	User accountantA;

	User staffA;

	Staff teacherStaff;

	User teacher;

	String classA1;

	String classA2;

	String classB;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		User admin = data.principal(schoolA, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		staffA = data.user(RoleCode.STAFF, schoolA);
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		String year = as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"C%s","startDate":"2026-08-15","endDate":"2027-05-31"}"""
			.formatted(UUID.randomUUID().toString().substring(0, 8)))).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String yearId = JsonPath.read(year, "$.id");
		String ageGroupId = ageGroups.findByCode("MAU_GIAO_4_5").orElseThrow().getId().toString();
		classA1 = createClass(principalA, schoolA, yearId, ageGroupId, "Lá 1", 30);
		classA2 = createClass(principalA, schoolA, yearId, ageGroupId, "Lá 2", 1);
		classB = createClass(principalB, schoolB, yearId, ageGroupId, "Lá 1", 30);
		as(principalA, post("/api/v1/classes/" + classA1 + "/teachers").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"staffId":"%s","role":"MAIN","fromDate":"2026-09-01"}""".formatted(teacherStaff.getId())),
				schoolA.getId())
			.andExpect(status().isCreated());
	}

	private String createClass(User user, School school, String yearId, String ageGroupId, String name, int capacity)
			throws Exception {
		String body = as(user, post("/api/v1/classes").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolYearId":"%s","ageGroupId":"%s","name":"%s","capacity":%d}""".formatted(yearId, ageGroupId,
				name, capacity)), school.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private ResultActions createChild(User user, School school, String name, String classId, String personalId,
			String guardians) throws Exception {
		String cls = classId == null ? "null" : "\"" + classId + "\"";
		String pid = personalId == null ? "null" : "\"" + personalId + "\"";
		return as(user, post("/api/v1/children").contentType(MediaType.APPLICATION_JSON).content("""
				{"profile":{"fullName":"%s","dob":"2021-03-10","gender":"FEMALE","personalId":%s,
				"allergyNote":"Dị ứng tôm"},
				"enrolledAt":"2026-09-01","classId":%s,"guardians":%s}""".formatted(name, pid, cls, guardians)),
				school.getId());
	}

	private String childId(User user, School school, String name, String classId) throws Exception {
		String body = createChild(user, school, name, classId, null, "[]").andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.item.id");
	}

	@Test
	void principalEnrollsChildAndOtherSchoolCannotSeeOrEditIt() throws Exception {
		String phone = "09" + TestData.randomDigits(8);
		createChild(principalA, schoolA, "Nguyễn Thị An", classA1, null, """
				[{"fullName":"Nguyễn Văn Bố","phone":"%s","relationship":"Bố","canPickUp":true},
				 {"fullName":"Trần Thị Mẹ","relationship":"Mẹ","primary":true,"canPickUp":true}]""".formatted(phone))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.item.className").value("Lá 1"))
			.andExpect(jsonPath("$.item.guardianName").value("Trần Thị Mẹ"))
			.andExpect(jsonPath("$.item.code").isNotEmpty())
			.andExpect(jsonPath("$.guardians", hasSize(2)))
			.andExpect(jsonPath("$.guardians[0].primary").value(true))
			.andExpect(jsonPath("$.enrollments", hasSize(1)))
			.andExpect(jsonPath("$.canEdit").value(true));
		String id = childId(principalA, schoolA, "Lê Văn Bình", classA1);

		as(principalA, get("/api/v1/children").param("classId", classA1), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2))
			.andExpect(jsonPath("$.items[0].fullName").value("Lê Văn Bình"));
		as(principalA, get("/api/v1/children").param("q", "an"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(1));
		as(principalB, get("/api/v1/children"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(0));
		as(principalB, get("/api/v1/children/" + id), schoolB.getId()).andExpect(status().isNotFound());
		as(principalB, put("/api/v1/children/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"fullName":"Đổi","dob":"2021-03-10","gender":"MALE"}"""), schoolB.getId())
			.andExpect(status().isNotFound());
		as(principalB, delete("/api/v1/children/" + id), schoolB.getId()).andExpect(status().isNotFound());
		createChild(principalB, schoolA, "Ngoài phạm vi", null, null, "[]").andExpect(status().isForbidden());
		createChild(principalA, schoolA, "Lớp cơ sở khác", classB, null, "[]").andExpect(status().isBadRequest());
		as(principalB, get("/api/v1/guardians").param("phone", phone), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void teacherSeesOnlyChildrenOfOwnClassAndCannotEdit() throws Exception {
		String mine = childId(principalA, schoolA, "Trẻ lớp mình", classA1);
		String other = childId(principalA, schoolA, "Trẻ lớp khác", classA2);

		as(teacher, get("/api/v1/children"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.items[0].id").value(mine));
		as(teacher, get("/api/v1/children/" + mine), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.canEdit").value(false));
		as(teacher, get("/api/v1/children/" + other), schoolA.getId()).andExpect(status().isNotFound());
		as(teacher, put("/api/v1/children/" + mine).contentType(MediaType.APPLICATION_JSON).content("""
				{"fullName":"Đổi","dob":"2021-03-10","gender":"MALE"}"""), schoolA.getId())
			.andExpect(status().isForbidden());

		as(accountantA, get("/api/v1/children"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2));
		createChild(accountantA, schoolA, "Kế toán tạo", null, null, "[]").andExpect(status().isForbidden());
		as(staffA, get("/api/v1/children"), schoolA.getId()).andExpect(status().isForbidden());
	}

	@Test
	void duplicatePersonalIdIsRejectedAcrossChain() throws Exception {
		String pid = TestData.randomDigits(12);
		createChild(principalA, schoolA, "Trẻ A", null, pid, "[]").andExpect(status().isCreated());
		createChild(principalB, schoolB, "Trẻ B", null, pid, "[]").andExpect(status().isConflict())
			.andExpect(jsonPath("$.errors[0].field").value("personalId"));
	}

	@Test
	void transferKeepsHistoryRespectsCapacityAndLeavingClosesEnrollment() throws Exception {
		String id = childId(principalA, schoolA, "Trẻ chuyển lớp", classA1);
		String filler = childId(principalA, schoolA, "Trẻ chiếm chỗ", null);

		as(principalA, post("/api/v1/children/" + id + "/transfer").contentType(MediaType.APPLICATION_JSON).content("""
				{"classId":"%s","fromDate":"2026-10-01"}""".formatted(classA2)), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.item.classId").value(classA2))
			.andExpect(jsonPath("$.enrollments", hasSize(2)))
			.andExpect(jsonPath("$.enrollments[1].toDate").value("2026-09-30"));
		as(principalA, post("/api/v1/children/" + filler + "/transfer").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"classId":"%s","fromDate":"2026-10-01"}""".formatted(classA2)), schoolA.getId())
			.andExpect(status().isConflict());
		as(principalA, post("/api/v1/children/" + id + "/transfer").contentType(MediaType.APPLICATION_JSON).content("""
				{"classId":"%s"}""".formatted(classB)), schoolA.getId())
			.andExpect(status().isBadRequest());

		as(principalA, post("/api/v1/children/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("""
				{"status":"LEFT","date":"2026-10-15","reason":"Chuyển nhà"}"""), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.item.status").value("LEFT"))
			.andExpect(jsonPath("$.item.classId").isEmpty())
			.andExpect(jsonPath("$.leftAt").value("2026-10-15"))
			.andExpect(jsonPath("$.enrollments[0].toDate").value("2026-10-15"));
		as(principalA, post("/api/v1/children/" + id + "/transfer").contentType(MediaType.APPLICATION_JSON).content("""
				{"classId":"%s"}""".formatted(classA1)), schoolA.getId())
			.andExpect(status().isConflict());
	}

	@Test
	void siblingsShareGuardianAndSinglePrimaryContact() throws Exception {
		String phone = "09" + TestData.randomDigits(8);
		String first = createChild(principalA, schoolA, "Anh", classA1, null, """
				[{"fullName":"Phạm Văn Bố","phone":"%s","relationship":"Bố","primary":true,"canPickUp":true}]"""
			.formatted(phone))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String guardianId = JsonPath.read(first, "$.guardians[0].guardianId");

		as(principalA, get("/api/v1/guardians").param("phone", phone), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].id").value(guardianId))
			.andExpect(jsonPath("$[0].childNames[0]").value("Anh"));

		String sibling = childId(principalA, schoolA, "Em", classA1);
		as(principalA, post("/api/v1/children/" + sibling + "/guardians").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"guardianId":"%s","relationship":"Bố","primary":true,"canPickUp":true}""".formatted(guardianId)),
				schoolA.getId())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$", hasSize(1)));
		as(principalA, post("/api/v1/children/" + sibling + "/guardians").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"guardianId":"%s","relationship":"Bố","canPickUp":true}""".formatted(guardianId)), schoolA.getId())
			.andExpect(status().isConflict());
		String list = as(principalA, post("/api/v1/children/" + sibling + "/guardians")
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"fullName":"Bà ngoại","relationship":"Bà","primary":true,"canPickUp":false}"""), schoolA.getId())
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].fullName").value("Bà ngoại"))
			.andExpect(jsonPath("$[1].primary").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String linkId = JsonPath.read(list, "$[1].id");

		as(principalB, delete("/api/v1/children/" + sibling + "/guardians/" + linkId), schoolB.getId())
			.andExpect(status().isNotFound());
		as(principalA, delete("/api/v1/children/" + sibling + "/guardians/" + linkId), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)));
		as(principalA, get("/api/v1/children/" + JsonPath.read(first, "$.item.id")), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.guardians", hasSize(1)));
	}

	@Test
	void deletedChildDisappears() throws Exception {
		String id = childId(principalA, schoolA, "Nhập nhầm", classA1);
		as(principalA, delete("/api/v1/children/" + id), schoolA.getId()).andExpect(status().isNoContent());
		as(principalA, get("/api/v1/children/" + id), schoolA.getId()).andExpect(status().isNotFound());
		as(principalA, get("/api/v1/classes/" + classA1), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.item.size").value(0));
	}

}
