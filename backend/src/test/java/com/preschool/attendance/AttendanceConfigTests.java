package com.preschool.attendance;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Cấu hình chấm công theo cơ sở và ngày lễ: quyền, chéo cơ sở, bản áp dụng. */
class AttendanceConfigTests extends ApiTestSupport {

	School schoolA;

	School schoolB;

	User admin;

	User principalA;

	User principalB;

	User teacherA;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		admin = data.user(RoleCode.CHAIN_ADMIN, null);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		teacherA = data.user(RoleCode.TEACHER, schoolA);
	}

	private ResultActions createConfig(User user, UUID schoolId, String from, String start, String halfDays)
			throws Exception {
		String school = schoolId == null ? "null" : "\"" + schoolId + "\"";
		return as(user, post("/api/v1/attendance/configs").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolId":%s,"effectiveFrom":"%s","shiftStart":"%s","shiftEnd":"17:00","lunchStart":"11:30",
				 "lunchEnd":"13:00","graceMinutes":10,"maxLateAllowed":2,"workingWeekdays":[1,2,3,4,5,6],
				 "halfDayWeekdays":%s,"annualLeaveDays":12}""".formatted(school, from, start, halfDays)),
				schoolId);
	}

	@Test
	void principalManagesOwnSchoolConfigAndLatestEffectiveVersionApplies() throws Exception {
		String today = LocalDate.now().toString();
		createConfig(principalA, schoolA.getId(), "2020-01-01", "07:00", "[6]").andExpect(status().isCreated())
			.andExpect(jsonPath("$.shiftStart").value("07:00:00"))
			.andExpect(jsonPath("$.halfDayWeekdays[0]").value(6));
		createConfig(principalA, schoolA.getId(), today, "07:15", "[]").andExpect(status().isCreated());
		createConfig(principalA, schoolA.getId(), LocalDate.now().plusDays(30).toString(), "08:00", "[]")
			.andExpect(status().isCreated());
		// Trùng ngày hiệu lực
		createConfig(principalA, schoolA.getId(), today, "07:15", "[]").andExpect(status().isConflict())
			.andExpect(jsonPath("$.errors[0].field").value("effectiveFrom"));

		as(principalA, get("/api/v1/attendance/configs?schoolId=" + schoolA.getId()), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.effective.shiftStart").value("07:15:00"))
			.andExpect(jsonPath("$.canManage").value(true));

		// Cơ sở khác, giáo viên, cấu hình toàn chuỗi
		createConfig(principalB, schoolA.getId(), "2021-01-01", "07:00", "[]").andExpect(status().isForbidden());
		as(principalB, get("/api/v1/attendance/configs?schoolId=" + schoolA.getId()), schoolB.getId())
			.andExpect(status().isForbidden());
		createConfig(teacherA, schoolA.getId(), "2021-01-01", "07:00", "[]").andExpect(status().isForbidden());
		createConfig(principalA, null, "2021-01-01", "07:00", "[]").andExpect(status().isForbidden());
	}

	@Test
	void invalidConfigsAreRejectedWithFieldErrors() throws Exception {
		createConfig(admin, schoolA.getId(), "2020-02-01", "18:00", "[]").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("shiftEnd"));
		createConfig(admin, schoolA.getId(), "2020-02-01", "07:00", "[7]").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("halfDayWeekdays"));
		// Mặc định toàn chuỗi: chỉ văn phòng điều hành (ngày ngẫu nhiên để không đụng test khác)
		LocalDate day = LocalDate.of(1990, 1, 1).plusDays(ThreadLocalRandom.current().nextInt(3000));
		createConfig(admin, null, day.toString(), "07:30", "[6]").andExpect(status().isCreated())
			.andExpect(jsonPath("$.schoolId").doesNotExist());
	}

	@Test
	void holidaysAreScopedToChainOrSchool() throws Exception {
		int year = 2090 + ThreadLocalRandom.current().nextInt(9);
		String body = as(principalA, post("/api/v1/holidays").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolId":"%s","fromDate":"%d-03-02","toDate":"%d-03-04","name":"Nghỉ bù hội thao"}"""
			.formatted(schoolA.getId(), year, year)), schoolA.getId())
			.andExpect(status().isCreated()).andExpect(jsonPath("$.length()").value(3))
			.andReturn().getResponse().getContentAsString();
		String schoolHoliday = JsonPath.read(body, "$[0].id");
		// Thêm lại cùng khoảng → đã có hết
		as(principalA, post("/api/v1/holidays").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolId":"%s","fromDate":"%d-03-02","name":"Trùng"}""".formatted(schoolA.getId(), year)),
				schoolA.getId())
			.andExpect(status().isConflict());

		as(principalA, post("/api/v1/holidays").contentType(MediaType.APPLICATION_JSON).content("""
				{"fromDate":"%d-01-01","name":"Tết Dương lịch"}""".formatted(year)), schoolA.getId())
			.andExpect(status().isForbidden());
		as(admin, post("/api/v1/holidays").contentType(MediaType.APPLICATION_JSON).content("""
				{"fromDate":"%d-01-01","name":"Tết Dương lịch"}""".formatted(year))).andExpect(status().isCreated());

		as(principalB, get("/api/v1/holidays?year=" + year), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", not(hasItem(schoolHoliday))))
			.andExpect(jsonPath("$[?(@.name == 'Tết Dương lịch')].canManage").value(false));
		as(principalA, get("/api/v1/holidays?year=" + year), schoolA.getId())
			.andExpect(jsonPath("$[*].id", hasItem(schoolHoliday)));
		as(principalB, delete("/api/v1/holidays/" + schoolHoliday), schoolB.getId()).andExpect(status().isNotFound());
		as(teacherA, get("/api/v1/holidays?year=" + year), schoolA.getId()).andExpect(status().isForbidden());
		as(principalA, delete("/api/v1/holidays/" + schoolHoliday), schoolA.getId()).andExpect(status().isNoContent());
	}

}
