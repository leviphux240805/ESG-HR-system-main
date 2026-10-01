package com.preschool.health;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.jayway.jsonpath.JsonPath;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.health.service.WhoStandards;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Sức khỏe: giáo viên cân đo, ghi sổ lớp mình; y tế cả cơ sở; cấp dưỡng, kế toán không xem; cơ sở B không thấy dữ
 * liệu cơ sở A; kết quả xếp kênh lưu đúng như bộ xếp kênh WHO.
 */
class HealthApiTests extends HealthApiTestBase {

	@Autowired
	WhoStandards standards;

	User nurseA;

	User kitchenA;

	User accountantA;

	User teacher;

	String classId;

	String otherClassId;

	String an;

	String binh;

	String other;

	@BeforeEach
	void setUp() throws Exception {
		setUpSchools();
		nurseA = data.user(RoleCode.NURSE, schoolA);
		kitchenA = data.user(RoleCode.KITCHEN, schoolA);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		classId = createClass("Chồi 1");
		otherClassId = createClass("Chồi 2");
		teacher = teacherOf(classId);
		an = enroll("An", classId, null);
		binh = enroll("Bình", classId, null);
		other = enroll("Lớp khác", otherClassId, null);
	}

	private ResultActions measure(User user, School school, String cls, LocalDate date, String rows) throws Exception {
		return as(user, put("/api/v1/classes/" + cls + "/measurements").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"date":"%s","source":"CLASS","rows":%s}""".formatted(date, rows)), school.getId());
	}

	private ResultActions log(User user, School school, String childId) throws Exception {
		return as(user, post("/api/v1/health-logs").contentType(MediaType.APPLICATION_JSON).content("""
				{"childId":"%s","logDate":"%s","type":"FEVER","content":"Sốt nhẹ","temperatureC":38.2}"""
			.formatted(childId, today)), school.getId());
	}

	@Test
	void teacherMeasuresOwnClassAndChannelMatchesWho() throws Exception {
		var expected = standards.classifier()
			.classify(Gender.MALE, LocalDate.of(2021, 5, 1), today, new BigDecimal("18.50"), new BigDecimal("110.0"));
		measure(teacher, schoolA, classId, today, """
				[{"childId":"%s","weightKg":18.5,"heightCm":110}]""".formatted(an)).andExpect(status().isOk())
			.andExpect(jsonPath("$.rows", hasSize(2)))
			.andExpect(jsonPath("$.rows[0].current.weightZ").value(expected.weightZ().doubleValue()))
			.andExpect(jsonPath("$.rows[0].current.heightZ").value(expected.heightZ().doubleValue()))
			.andExpect(jsonPath("$.rows[0].current.weightStatus").value(expected.weightStatus().name()))
			.andExpect(jsonPath("$.rows[0].current.bmiStatus").value(expected.bmiStatus().name()))
			.andExpect(jsonPath("$.rows[0].current.standard").value(expected.standard().name()))
			.andExpect(jsonPath("$.rows[0].current.source").value("CLASS"))
			.andExpect(jsonPath("$.rows[1].current").doesNotExist());

		measure(teacher, schoolA, otherClassId, today, """
				[{"childId":"%s","weightKg":18.5,"heightCm":110}]""".formatted(other)).andExpect(status().isNotFound());
		measure(teacher, schoolA, classId, today, """
				[{"childId":"%s","weightKg":18.5,"heightCm":110}]""".formatted(other)).andExpect(status().isBadRequest());
		measure(teacher, schoolA, classId, today.plusDays(1), """
				[{"childId":"%s","weightKg":18.5,"heightCm":110}]""".formatted(an)).andExpect(status().isBadRequest());
		measure(teacher, schoolA, classId, today, """
				[{"childId":"%s","weightKg":0,"heightCm":110}]""".formatted(an)).andExpect(status().isBadRequest());
		measure(nurseA, schoolA, otherClassId, today, """
				[{"childId":"%s","weightKg":17,"heightCm":105}]""".formatted(other)).andExpect(status().isOk());
	}

	@Test
	void otherSchoolAndNonHealthRolesAreBlocked() throws Exception {
		measure(nurseA, schoolA, classId, today, """
				[{"childId":"%s","weightKg":18.5,"heightCm":110}]""".formatted(an)).andExpect(status().isOk());
		log(nurseA, schoolA, an).andExpect(status().isCreated());

		as(principalB, get("/api/v1/classes/" + classId + "/measurements"), schoolB.getId())
			.andExpect(status().isNotFound());
		measure(principalB, schoolB, classId, today, """
				[{"childId":"%s","weightKg":18.5,"heightCm":110}]""".formatted(an)).andExpect(status().isNotFound());
		as(principalB, get("/api/v1/children/" + an + "/health"), schoolB.getId()).andExpect(status().isNotFound());
		as(principalB, get("/api/v1/health-logs"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)));
		log(principalB, schoolB, an).andExpect(status().isNotFound());

		as(kitchenA, get("/api/v1/classes/" + classId + "/measurements"), schoolA.getId())
			.andExpect(status().isForbidden());
		as(kitchenA, get("/api/v1/health-logs"), schoolA.getId()).andExpect(status().isForbidden());
		as(accountantA, get("/api/v1/children/" + an + "/health"), schoolA.getId()).andExpect(status().isForbidden());
	}

	@Test
	void teacherKeepsLogForOwnClassOnly() throws Exception {
		String id = JsonPath.read(log(teacher, schoolA, an).andExpect(status().isCreated())
			.andExpect(jsonPath("$.className").value("Chồi 1"))
			.andExpect(jsonPath("$.parentNotifiedAt").doesNotExist())
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.id");
		log(teacher, schoolA, other).andExpect(status().isNotFound());
		log(nurseA, schoolA, other).andExpect(status().isCreated());

		as(teacher, get("/api/v1/health-logs"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(1)));
		as(nurseA, get("/api/v1/health-logs?q=lop khac"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(1)));
		as(teacher, post("/api/v1/health-logs/" + id + "/notify-parent"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.parentNotifiedAt", notNullValue()))
			.andExpect(jsonPath("$.parentNotifiedByName", notNullValue()));
		as(principalB, post("/api/v1/health-logs/" + id + "/notify-parent"), schoolB.getId())
			.andExpect(status().isNotFound());
	}

	@Test
	void childHealthHasChartAndCheckups() throws Exception {
		measure(teacher, schoolA, classId, today.minusDays(5), """
				[{"childId":"%s","weightKg":18,"heightCm":109}]""".formatted(an)).andExpect(status().isOk());
		measure(teacher, schoolA, classId, today, """
				[{"childId":"%s","weightKg":18.4,"heightCm":109.5}]""".formatted(an)).andExpect(status().isOk())
			.andExpect(jsonPath("$.rows[0].previous.weightKg").value(18));

		String checkup = """
				{"checkupDate":"%s","provider":"Trạm y tế phường","summary":"Sức khỏe tốt"}""".formatted(today);
		as(teacher, post("/api/v1/children/" + an + "/checkups").contentType(MediaType.APPLICATION_JSON).content(checkup),
				schoolA.getId())
			.andExpect(status().isForbidden());
		as(nurseA, post("/api/v1/children/" + an + "/checkups").contentType(MediaType.APPLICATION_JSON).content(checkup),
				schoolA.getId())
			.andExpect(status().isCreated());

		as(teacher, get("/api/v1/children/" + an + "/health"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.growth.measurements", hasSize(2)))
			.andExpect(jsonPath("$.growth.weightCurve[0].ageMonths").value(0))
			.andExpect(jsonPath("$.growth.bmiCurve[60].median", notNullValue()))
			.andExpect(jsonPath("$.growth.canEdit").value(true))
			.andExpect(jsonPath("$.checkups", hasSize(1)))
			.andExpect(jsonPath("$.canEditCheckups").value(false));
		as(nurseA, get("/api/v1/children/" + an + "/health"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.canEditCheckups").value(true));
		as(teacher, get("/api/v1/children/" + other + "/health"), schoolA.getId()).andExpect(status().isNotFound());
	}

}
