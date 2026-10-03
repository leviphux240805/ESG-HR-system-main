package com.preschool.today;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Hôm nay, dạy thay, Hộp duyệt: chỉ ban giám hiệu quản lý lớp xem Hôm nay, chỉ thấy trường của mình (không thấy trường
 * khác hay tổ chức khác); phân công dạy thay trong cùng trường; Hộp duyệt chỉ gồm mục người xem duyệt được.
 */
class TodayApiTests extends ApiTestSupport {

	@Autowired
	AgeGroupRepository ageGroups;

	@Autowired
	JdbcTemplate jdbc;

	final LocalDate today = LocalDate.now(ZoneId.of(SchedulingConfig.ZONE));

	School schoolA;

	School schoolB;

	User principalA;

	User principalB;

	User viceClassroom;

	Staff teacherStaff;

	User teacher;

	Staff substituteStaff;

	User substitute;

	String classId;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		principalA = data.principal(schoolA);
		principalB = data.principal(schoolB);
		viceClassroom = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM);
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		substituteStaff = data.staff(schoolA, Position.TEACHER);
		substitute = data.userForStaff(RoleCode.TEACHER, schoolA, substituteStaff);
		jdbc.update("""
				INSERT INTO attendance_configs (organization_id, school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
				  late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days)
				SELECT organization_id, id, '2020-01-01', '07:30', '17:00', '11:30', '13:00', 15, 3, '{1,2,3,4,5,6,7}', '{}', 12
				FROM schools WHERE id = ?""", schoolA.getId());

		String year = as(principalA, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"H%s","startDate":"%s","endDate":"%s"}""".formatted(UUID.randomUUID().toString().substring(0, 8),
				today.minusMonths(2), today.plusMonths(6))))
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		String ageGroupId = ageGroups.findByOrganizationIdAndCode(TestData.DEFAULT_ORG, "MAU_GIAO_4_5")
			.orElseThrow().getId().toString();
		classId = JsonPath.read(as(principalA, post("/api/v1/classes").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolYearId":"%s","ageGroupId":"%s","name":"Chồi Hôm Nay"}""".formatted(JsonPath.read(year, "$.id"),
				ageGroupId)), schoolA.getId())
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
		as(principalA, post("/api/v1/classes/" + classId + "/teachers").contentType(MediaType.APPLICATION_JSON).content("""
				{"staffId":"%s","role":"MAIN","fromDate":"%s"}""".formatted(teacherStaff.getId(), today.minusDays(30))),
				schoolA.getId())
			.andExpect(status().isCreated());
		String an = enroll("An");
		String binh = enroll("Bình");
		as(principalA, put("/api/v1/classes/" + classId + "/attendance").contentType(MediaType.APPLICATION_JSON).content("""
				{"date":"%s","rows":[{"childId":"%s","status":"PRESENT"},{"childId":"%s","status":"EXCUSED","note":"Ốm"}]}"""
			.formatted(today, an, binh)), schoolA.getId())
			.andExpect(status().isOk());
		leave(teacherStaff, "APPROVED");
	}

	@Test
	void principalSeesOwnSchoolsOnly() throws Exception {
		today(principalA).andExpect(status().isOk())
			.andExpect(jsonPath("$.canAssignSubstitute").value(true))
			.andExpect(jsonPath(classPath(".present")).value(1))
			.andExpect(jsonPath(classPath(".excused")).value(1))
			.andExpect(jsonPath(classPath(".taken")).value(true))
			.andExpect(jsonPath(classPath(".shortStaffed")).value(true))
			.andExpect(jsonPath(classPath(".teachers[0].onLeave")).value(true))
			.andExpect(jsonPath("$.absentChildren[*].fullName", hasItem("Bình")))
			.andExpect(jsonPath("$.staffOnLeave[*].staffId", hasItem(teacherStaff.getId().toString())))
			.andExpect(jsonPath("$.staffOnLeave[?(@.staffId=='%s')].classes[0].classId".formatted(teacherStaff.getId()))
				.value(classId))
			.andExpect(jsonPath("$.availableStaff[*].staffId", hasItem(substituteStaff.getId().toString())))
			.andExpect(jsonPath("$.availableStaff[*].staffId", not(hasItem(teacherStaff.getId().toString()))));
		today(viceClassroom).andExpect(status().isOk());

		today(principalB).andExpect(status().isOk()).andExpect(jsonPath("$.classes[*].id", not(hasItem(classId))));
		User foreign = data.principal(data.school(data.organization()));
		as(foreign, get("/api/v1/today")).andExpect(status().isOk())
			.andExpect(jsonPath("$.classes[*].id", not(hasItem(classId))))
			.andExpect(jsonPath("$.staffOnLeave[*].staffId", not(hasItem(teacherStaff.getId().toString()))));
	}

	@Test
	void staffWithoutClassroomGroupCannotSeeToday() throws Exception {
		today(teacher).andExpect(status().isForbidden());
		today(data.vicePrincipal(schoolA, FunctionGroup.FINANCE)).andExpect(status().isForbidden());
		today(data.user(RoleCode.ACCOUNTANT, schoolA)).andExpect(status().isForbidden());
	}

	@Test
	void assignSubstituteWithinSchoolAndNotify() throws Exception {
		substitute(teacher, substituteStaff).andExpect(status().isForbidden());
		substitute(principalB, substituteStaff).andExpect(status().isNotFound());
		substitute(viceClassroom, data.staff(schoolB, Position.TEACHER)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("staffId"));
		as(viceClassroom, post("/api/v1/substitutions").contentType(MediaType.APPLICATION_JSON).content("""
				{"classId":"%s","absentStaffId":"%s","staffId":"%s"}""".formatted(classId, substituteStaff.getId(),
				teacherStaff.getId())), schoolA.getId())
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("NOT_CLASS_TEACHER"));

		substitute(viceClassroom, substituteStaff).andExpect(status().isNoContent());
		substitute(data.vicePrincipal(schoolA, FunctionGroup.HR), substituteStaff).andExpect(status().isNoContent());
		today(principalA).andExpect(jsonPath(classPath(".shortStaffed")).value(false))
			.andExpect(jsonPath(classPath(".teachers[0].substituteName")).value(substituteStaff.getFullName()));
		as(substitute, get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(1));
	}

	@Test
	void approvalsListOnlyReviewableItemsAndDecide() throws Exception {
		Staff requesterStaff = data.staff(schoolA, Position.TEACHER);
		data.userForStaff(RoleCode.TEACHER, schoolA, requesterStaff);
		UUID leaveId = leave(requesterStaff, "PENDING");
		String taskId = JsonPath.read(as(principalA, post("/api/v1/tasks").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolId":"%s","title":"Trang trí lớp","priority":"MEDIUM","assigneeStaffIds":["%s"]}"""
			.formatted(schoolA.getId(), substituteStaff.getId())), schoolA.getId())
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
		jdbc.update("UPDATE tasks SET status = 'WAITING_APPROVAL' WHERE id = ?::uuid", taskId);

		as(principalA, get("/api/v1/approvals"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", hasItem(leaveId.toString())))
			.andExpect(jsonPath("$[*].id", hasItem(taskId)))
			.andExpect(jsonPath("$[?(@.id=='%s')].leave.reason".formatted(leaveId)).value("Việc gia đình"))
			.andExpect(jsonPath("$[?(@.id=='%s')].task.title".formatted(taskId)).value("Trang trí lớp"));
		as(principalB, get("/api/v1/approvals"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", not(hasItem(leaveId.toString()))))
			.andExpect(jsonPath("$[*].id", not(hasItem(taskId))));
		as(teacher, get("/api/v1/approvals")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

		decide(principalB, "TASK", taskId, "approve", "{}").andExpect(status().isNotFound());
		decide(teacher, "TASK", taskId, "approve", "{}").andExpect(status().isNotFound());
		decide(principalA, "LEAVE", leaveId.toString(), "reject", "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("note"));
		decide(principalA, "LEAVE", leaveId.toString(), "reject", "{\"note\":\"Trùng lịch kiểm tra\"}")
			.andExpect(status().isNoContent());
		decide(principalA, "TASK", taskId, "approve", "{}").andExpect(status().isNoContent());

		assertThat(jdbc.queryForObject("SELECT status FROM leave_requests WHERE id = ?", String.class, leaveId))
			.isEqualTo("REJECTED");
		assertThat(jdbc.queryForObject("SELECT status FROM tasks WHERE id = ?::uuid", String.class, taskId))
			.isEqualTo("DONE");
		as(principalA, get("/api/v1/approvals"), schoolA.getId()).andExpect(jsonPath("$[*].id", not(hasItem(taskId))));
	}

	private ResultActions today(User user) throws Exception {
		return as(user, get("/api/v1/today"));
	}

	private String classPath(String field) {
		return "$.classes[?(@.id=='%s')]%s".formatted(classId, field);
	}

	private ResultActions substitute(User user, Staff staff) throws Exception {
		return as(user, post("/api/v1/substitutions").contentType(MediaType.APPLICATION_JSON).content("""
				{"classId":"%s","absentStaffId":"%s","staffId":"%s"}""".formatted(classId, teacherStaff.getId(),
				staff.getId())));
	}

	private ResultActions decide(User user, String type, String id, String action, String body) throws Exception {
		return as(user, post("/api/v1/approvals/%s/%s/%s".formatted(type, id, action))
			.contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private UUID leave(Staff staff, String status) {
		return jdbc.queryForObject("""
				INSERT INTO leave_requests (school_id, staff_id, leave_code, from_date, to_date, days, reason, status)
				VALUES (?, ?, 'P', ?, ?, 1, 'Việc gia đình', ?) RETURNING id""", UUID.class, schoolA.getId(), staff.getId(),
				today, today, status);
	}

	private String enroll(String name) throws Exception {
		String body = as(principalA, post("/api/v1/children").contentType(MediaType.APPLICATION_JSON).content("""
				{"profile":{"fullName":"%s","dob":"2021-05-01","gender":"MALE"},"enrolledAt":"%s","classId":"%s",
				"guardians":[{"fullName":"Mẹ %s","relationship":"Mẹ","primary":true}]}""".formatted(name,
				today.minusDays(10), classId, name)), schoolA.getId())
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		return JsonPath.read(body, "$.item.id");
	}

}
