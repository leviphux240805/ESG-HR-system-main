package com.preschool.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.service.StaffExpiryNotifier;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** Giấy tờ sắp hết hạn, job thông báo và API thông báo. */
class StaffExpiryTests extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	StaffExpiryNotifier notifier;

	School schoolA;

	School schoolB;

	Staff staffA;

	Staff staffB;

	LocalDate today = LocalDate.now();

	@BeforeEach
	void setUpExpiring() {
		schoolA = data.school();
		schoolB = data.school();
		staffA = data.staff(schoolA, Position.TEACHER);
		staffB = data.staff(schoolB, Position.TEACHER);
		contract(staffA, today.minusYears(1), today.plusDays(10));
		contract(staffB, today.minusYears(1), today.plusDays(20));
		// Hợp đồng cũ đã được thay bằng hợp đồng mới không thời hạn: không cảnh báo
		Staff renewed = data.staff(schoolA, Position.NANNY);
		contract(renewed, today.minusYears(2), today.plusDays(5));
		contract(renewed, today.minusDays(1), null);
		jdbc.update("INSERT INTO staff_certificates (staff_id, name, expiry_date) VALUES (?, 'Sơ cấp cứu', ?)",
				staffA.getId(), today.plusDays(50));
	}

	@Test
	void principalSeesOnlyCurrentDocumentsOfOwnSchool() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);

		as(principalA, get("/api/v1/staff/expiring-documents?within=30&size=100")).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].staffId", hasItem(staffA.getId().toString())))
			.andExpect(jsonPath("$.items[*].staffId", not(hasItem(staffB.getId().toString()))))
			.andExpect(jsonPath("$.items[?(@.staffId=='%s')].tab".formatted(staffA.getId())).value("contracts"))
			.andExpect(jsonPath("$.items[?(@.staffId=='%s')].daysLeft".formatted(staffA.getId())).value(10));

		String body = as(principalA, get("/api/v1/staff/expiring-documents?within=60&size=100"))
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		assertThat(JsonPath.<java.util.List<String>>read(body, "$.items[*].kind")).contains("CERTIFICATE");
		String certOnly = as(principalA, get("/api/v1/staff/expiring-documents?within=60&kind=CERTIFICATE&size=100"))
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		assertThat(JsonPath.<java.util.List<String>>read(certOnly, "$.items[*].kind")).containsOnly("CERTIFICATE");

		User teacher = data.user(RoleCode.TEACHER, schoolA);
		as(teacher, get("/api/v1/staff/expiring-documents")).andExpect(status().isForbidden());
	}

	@Test
	void dailyJobNotifiesRightPeopleOnce() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		User principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		User admin = data.principal(schoolA, schoolB);

		int first = notifier.run(today);
		int second = notifier.run(today);
		assertThat(first).isPositive();
		assertThat(second).isZero();

		String linkA = "/nhan-su/" + staffA.getId() + "?tab=contracts";
		String linkB = "/nhan-su/" + staffB.getId() + "?tab=contracts";
		assertThat(links(principalA)).contains(linkA).doesNotContain(linkB);
		assertThat(links(principalB)).contains(linkB).doesNotContain(linkA);
		assertThat(links(admin)).contains(linkA, linkB);
	}

	@Test
	void notificationsAreReadableAndMarkableOnlyByOwner() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		User other = data.user(RoleCode.PRINCIPAL, schoolA);
		notifier.run(today);

		String body = as(principalA, get("/api/v1/notifications")).andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(body, "$.items[0].id");
		int unread = JsonPath.read(as(principalA, get("/api/v1/notifications/unread-count"))
			.andReturn().getResponse().getContentAsString(), "$.count");
		assertThat(unread).isPositive();

		as(other, post("/api/v1/notifications/" + id + "/read")).andExpect(status().isNotFound());
		as(principalA, post("/api/v1/notifications/" + id + "/read")).andExpect(status().isOk())
			.andExpect(jsonPath("$.readAt").isNotEmpty());
		as(principalA, post("/api/v1/notifications/read-all")).andExpect(status().isOk());
		as(principalA, get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(0));
	}

	private java.util.List<String> links(User user) {
		return jdbc.queryForList("SELECT link FROM notifications WHERE user_id = ?", String.class, user.getId());
	}

	private void contract(Staff staff, LocalDate start, LocalDate end) {
		jdbc.update("INSERT INTO staff_contracts (staff_id, contract_type, start_date, end_date) VALUES (?, ?, ?, ?)",
				staff.getId(), end == null ? "INDEFINITE" : "DEFINITE", start, end);
	}

}
