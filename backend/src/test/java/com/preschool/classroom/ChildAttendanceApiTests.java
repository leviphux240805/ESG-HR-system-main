package com.preschool.classroom;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.classroom.entity.ChildAttendanceConfig;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.classroom.repository.ChildAttendanceConfigRepository;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Điểm danh trẻ: giáo viên điểm danh lớp mình trong ngày trước giờ báo ăn, hiệu trưởng sửa được ngày đã qua, đã chốt
 * thì không ai sửa cho tới khi mở lại kèm lý do, trẻ bảo lưu không có trong danh sách, cơ sở B không xem/sửa lớp A.
 */
class ChildAttendanceApiTests extends ApiTestSupport {

	@Autowired
	AgeGroupRepository ageGroups;

	@Autowired
	ChildAttendanceConfigRepository configs;

	final LocalDate today = LocalDate.now(ZoneId.of(SchedulingConfig.ZONE));

	School schoolA;

	School schoolB;

	User principalA;

	User principalB;

	User accountantA;

	User teacher;

	String classId;

	String otherClassId;

	String an;

	String binh;

	String reserved;

	String inOtherClass;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		// Giờ báo ăn cuối ngày để giáo viên luôn còn trong giờ điểm danh khi chạy test
		configs.save(TestData.inDefaultOrg(new ChildAttendanceConfig(schoolA.getId(), today.minusYears(1), LocalTime.of(23, 59, 59))));
		User admin = data.principal(schoolA, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		Staff teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		String year = as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"D%s","startDate":"%s","endDate":"%s"}""".formatted(UUID.randomUUID().toString().substring(0, 8),
				today.minusMonths(2), today.plusMonths(6))))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String yearId = JsonPath.read(year, "$.id");
		String ageGroupId = ageGroups.findByCode("MAU_GIAO_4_5").orElseThrow().getId().toString();
		classId = createClass(yearId, ageGroupId, "Chồi 1");
		otherClassId = createClass(yearId, ageGroupId, "Chồi 2");
		as(principalA, post("/api/v1/classes/" + classId + "/teachers").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"staffId":"%s","role":"MAIN","fromDate":"%s"}""".formatted(teacherStaff.getId(), today.minusDays(30))),
				schoolA.getId())
			.andExpect(status().isCreated());
		an = enroll("An", classId);
		binh = enroll("Bình", classId);
		reserved = enroll("Bảo lưu", classId);
		inOtherClass = enroll("Lớp khác", otherClassId);
		as(principalA, post("/api/v1/children/" + reserved + "/status").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"status":"RESERVED","date":"%s"}""".formatted(today)), schoolA.getId())
			.andExpect(status().isOk());
	}

	private String createClass(String yearId, String ageGroupId, String name) throws Exception {
		String body = as(principalA, post("/api/v1/classes").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolYearId":"%s","ageGroupId":"%s","name":"%s"}""".formatted(yearId, ageGroupId, name)),
				schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private String enroll(String name, String classId) throws Exception {
		String body = as(principalA, post("/api/v1/children").contentType(MediaType.APPLICATION_JSON).content("""
				{"profile":{"fullName":"%s","dob":"2021-05-01","gender":"MALE"},"enrolledAt":"%s","classId":"%s",
				"guardians":[{"fullName":"Mẹ %s","relationship":"Mẹ","primary":true}]}""".formatted(name,
				today.minusDays(10), classId, name)), schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.item.id");
	}

	private ResultActions mark(User user, School school, LocalDate date, String rows) throws Exception {
		return as(user, put("/api/v1/classes/" + classId + "/attendance").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"date":"%s","rows":%s}""".formatted(date, rows)), school.getId());
	}

	private String both() {
		return """
				[{"childId":"%s","status":"PRESENT","checkInTime":"07:30"},
				 {"childId":"%s","status":"EXCUSED","note":"Ốm"}]""".formatted(an, binh);
	}

	@Test
	void teacherMarksOwnClassAndReservedChildIsHidden() throws Exception {
		as(teacher, get("/api/v1/classes/" + classId + "/attendance"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.rows", hasSize(2)))
			.andExpect(jsonPath("$.canEdit").value(true))
			.andExpect(jsonPath("$.summary.unmarked").value(2))
			.andExpect(jsonPath("$.rows[0].pickUps", hasSize(1)));

		mark(teacher, schoolA, today, both()).andExpect(status().isOk())
			.andExpect(jsonPath("$.summary.present").value(1))
			.andExpect(jsonPath("$.summary.excused").value(1))
			.andExpect(jsonPath("$.summary.unmarked").value(0))
			.andExpect(jsonPath("$.rows[0].fullName").value("An"))
			.andExpect(jsonPath("$.rows[0].checkInTime").value("07:30:00"))
			.andExpect(jsonPath("$.rows[1].note").value("Ốm"));

		as(principalA, get("/api/v1/classes/" + classId), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.item.presentToday").value(1));
	}

	@Test
	void otherSchoolAndViewOnlyRolesCannotMark() throws Exception {
		as(principalB, get("/api/v1/classes/" + classId + "/attendance"), schoolB.getId())
			.andExpect(status().isNotFound());
		mark(principalB, schoolB, today, both()).andExpect(status().isNotFound());
		as(accountantA, get("/api/v1/classes/" + classId + "/attendance"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.canEdit").value(false));
		mark(accountantA, schoolA, today, both()).andExpect(status().isForbidden());
		as(teacher, get("/api/v1/classes/" + otherClassId + "/attendance"), schoolA.getId())
			.andExpect(status().isNotFound());
	}

	@Test
	void teacherCannotEditPastDaysButPrincipalCan() throws Exception {
		LocalDate yesterday = today.minusDays(1);
		mark(teacher, schoolA, yesterday, both()).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ATTENDANCE_CUTOFF"));
		mark(principalA, schoolA, yesterday, both()).andExpect(status().isOk());
		mark(principalA, schoolA, today.plusDays(1), both()).andExpect(status().isBadRequest());
	}

	@Test
	void invalidChildOrPickUpPersonIsRejected() throws Exception {
		mark(teacher, schoolA, today, """
				[{"childId":"%s","status":"PRESENT"}]""".formatted(inOtherClass)).andExpect(status().isBadRequest());
		mark(teacher, schoolA, today, """
				[{"childId":"%s","status":"PRESENT"}]""".formatted(reserved)).andExpect(status().isBadRequest());
		mark(teacher, schoolA, today, """
				[{"childId":"%s","status":"PRESENT","pickedUpBy":"%s"}]""".formatted(an, UUID.randomUUID()))
			.andExpect(status().isBadRequest());
	}

	@Test
	void lockedDayNeedsPrincipalToReopen() throws Exception {
		String lockUrl = "/api/v1/classes/" + classId + "/attendance/lock";
		String body = "{\"date\":\"%s\"}".formatted(today);
		mark(teacher, schoolA, today, """
				[{"childId":"%s","status":"PRESENT"}]""".formatted(an)).andExpect(status().isOk());
		as(teacher, post(lockUrl).contentType(MediaType.APPLICATION_JSON).content(body), schoolA.getId())
			.andExpect(status().isBadRequest());
		mark(teacher, schoolA, today, both()).andExpect(status().isOk());
		as(teacher, post(lockUrl).contentType(MediaType.APPLICATION_JSON).content(body), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.locked").value(true))
			.andExpect(jsonPath("$.canEdit").value(false));
		mark(teacher, schoolA, today, both()).andExpect(status().isConflict());
		mark(principalA, schoolA, today, both()).andExpect(status().isConflict());

		String unlockUrl = "/api/v1/classes/" + classId + "/attendance/unlock";
		String reason = """
				{"date":"%s","reason":"Nhập nhầm"}""".formatted(today);
		as(teacher, post(unlockUrl).contentType(MediaType.APPLICATION_JSON).content(reason), schoolA.getId())
			.andExpect(status().isForbidden());
		as(principalA, post(unlockUrl).contentType(MediaType.APPLICATION_JSON).content(body), schoolA.getId())
			.andExpect(status().isBadRequest());
		as(principalB, post(unlockUrl).contentType(MediaType.APPLICATION_JSON).content(reason), schoolB.getId())
			.andExpect(status().isNotFound());
		as(principalA, post(unlockUrl).contentType(MediaType.APPLICATION_JSON).content(reason), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.locked").value(false));
		mark(teacher, schoolA, today, both()).andExpect(status().isOk());
	}

	@Test
	void monthlyRollBookShowsMarksTotalsAndPermissions() throws Exception {
		mark(teacher, schoolA, today, both()).andExpect(status().isOk());
		String month = today.toString().substring(0, 7);
		String an = "$.rows[?(@.fullName=='An')]";
		as(principalA, get("/api/v1/classes/" + classId + "/attendance/month?month=" + month), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.rows[*].fullName", org.hamcrest.Matchers.containsInAnyOrder("An", "Bình")))
			.andExpect(jsonPath(an + ".cells['%s']".formatted(today)).value("PRESENT"))
			.andExpect(jsonPath(an + ".present").value(1))
			.andExpect(jsonPath("$.rows[?(@.fullName=='Bình')].notes['%s']".formatted(today)).value("Ốm"))
			.andExpect(jsonPath("$.days[?(@.date=='%s')].present".formatted(today)).value(1))
			.andExpect(jsonPath("$.days[?(@.date=='%s')].excused".formatted(today)).value(1))
			.andExpect(jsonPath("$.days[?(@.date=='%s')].editable".formatted(today)).value(true));
		as(accountantA, get("/api/v1/classes/" + classId + "/attendance/month?month=" + month), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days[?(@.date=='%s')].editable".formatted(today)).value(false));
		as(principalB, get("/api/v1/classes/" + classId + "/attendance/month?month=" + month), schoolB.getId())
			.andExpect(status().isNotFound());
		as(teacher, get("/api/v1/classes/" + otherClassId + "/attendance/month?month=" + month), schoolA.getId())
			.andExpect(status().isNotFound());
		as(principalA, get("/api/v1/classes/" + classId + "/attendance/month?month=2026-13"), schoolA.getId())
			.andExpect(status().isBadRequest());
		as(principalA, get("/api/v1/classes/" + classId + "/attendance/month/export?month=" + month), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
				.string("Content-Type", org.hamcrest.Matchers.startsWith("application/vnd.openxmlformats")));
		as(principalB, get("/api/v1/classes/" + classId + "/attendance/month/export?month=" + month), schoolB.getId())
			.andExpect(status().isNotFound());
	}

}
