package com.preschool.health;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** Dựng nhanh năm học, lớp, trẻ, giáo viên phụ trách cho test module Thực đơn & sức khỏe. */
public abstract class HealthApiTestBase extends ApiTestSupport {

	@Autowired
	protected AgeGroupRepository ageGroups;

	protected final LocalDate today = LocalDate.now(ZoneId.of(SchedulingConfig.ZONE));

	protected School schoolA;

	protected School schoolB;

	protected User admin;

	protected User principalA;

	protected User principalB;

	protected String yearId;

	protected String ageGroupId;

	protected void setUpSchools() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		admin = data.principal(schoolA, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		String year = as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"H%s","startDate":"%s","endDate":"%s"}""".formatted(UUID.randomUUID().toString().substring(0, 8),
				today.minusMonths(2), today.plusMonths(6))))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		yearId = JsonPath.read(year, "$.id");
		ageGroupId = ageGroups.findByCode("MAU_GIAO_4_5").orElseThrow().getId().toString();
	}

	protected String createClass(String name) throws Exception {
		String body = as(principalA, post("/api/v1/classes").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolYearId":"%s","ageGroupId":"%s","name":"%s"}""".formatted(yearId, ageGroupId, name)),
				schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	protected User teacherOf(String classId) throws Exception {
		Staff staff = data.staff(schoolA, Position.TEACHER);
		User teacher = data.userForStaff(RoleCode.TEACHER, schoolA, staff);
		as(principalA, post("/api/v1/classes/" + classId + "/teachers").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"staffId":"%s","role":"MAIN","fromDate":"%s"}""".formatted(staff.getId(), today.minusDays(30))),
				schoolA.getId())
			.andExpect(status().isCreated());
		return teacher;
	}

	protected String enroll(String name, String classId, String allergyNote) throws Exception {
		String allergy = allergyNote == null ? "" : ",\"allergyNote\":\"%s\"".formatted(allergyNote);
		String body = as(principalA, post("/api/v1/children").contentType(MediaType.APPLICATION_JSON).content("""
				{"profile":{"fullName":"%s","dob":"2021-05-01","gender":"MALE"%s},"enrolledAt":"%s","classId":"%s",
				"guardians":[{"fullName":"Mẹ %s","relationship":"Mẹ","primary":true}]}""".formatted(name, allergy,
				today.minusDays(10), classId, name)), schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.item.id");
	}

}
