package com.preschool.security;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.common.error.ApiException;
import com.preschool.school.entity.Holiday;
import com.preschool.school.entity.School;
import com.preschool.school.repository.HolidayRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** User cơ sở A không đọc được dữ liệu cơ sở B, dù gửi header hay gọi theo id. */
@Import(SchoolScopeTests.HolidayProbeController.class)
class SchoolScopeTests extends ApiTestSupport {

	@Autowired
	HolidayRepository holidays;

	School schoolA;

	School schoolB;

	Holiday shared;

	Holiday holidayA;

	Holiday holidayB;

	@BeforeEach
	void setUpData() {
		schoolA = data.school();
		schoolB = data.school();
		shared = holidays.save(new Holiday(null, randomDate(), "Ngày chung", false));
		holidayA = holidays.save(new Holiday(schoolA.getId(), randomDate(), "Nghỉ riêng A", true));
		holidayB = holidays.save(new Holiday(schoolB.getId(), randomDate(), "Nghỉ riêng B", true));
	}

	@Test
	void schoolUserSeesSharedAndOwnSchoolOnly() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);

		list(teacherA, null).andExpect(status().isOk())
			.andExpect(jsonPath("$[*]", hasItems(shared.getId().toString(), holidayA.getId().toString())))
			.andExpect(jsonPath("$[*]", not(hasItem(holidayB.getId().toString()))));
	}

	@Test
	void schoolUserCannotSelectOtherSchool() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);

		list(teacherA, schoolB.getId().toString()).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("SCHOOL_FORBIDDEN"));
	}

	@Test
	void schoolUserCannotLoadOtherSchoolRowById() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);

		byId(teacherA, holidayB.getId(), null).andExpect(status().isNotFound());
		byId(teacherA, holidayA.getId(), null).andExpect(status().isOk());
		byId(teacherA, shared.getId(), null).andExpect(status().isOk());
	}

	@Test
	void chainUserSeesEverythingOrOneSelectedSchool() throws Exception {
		User owner = data.user(RoleCode.OWNER, null);

		list(owner, null).andExpect(status().isOk())
			.andExpect(jsonPath("$[*]", hasItems(shared.getId().toString(), holidayA.getId().toString(),
					holidayB.getId().toString())));
		list(owner, schoolB.getId().toString()).andExpect(status().isOk())
			.andExpect(jsonPath("$[*]", hasItems(shared.getId().toString(), holidayB.getId().toString())))
			.andExpect(jsonPath("$[*]", not(hasItem(holidayA.getId().toString()))));
		byId(owner, holidayA.getId(), schoolB.getId().toString()).andExpect(status().isNotFound());
	}

	@Test
	void accountantOfOneSchoolIsLimitedToIt() throws Exception {
		User accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);

		list(accountantA, null).andExpect(status().isOk())
			.andExpect(jsonPath("$[*]", not(hasItem(holidayB.getId().toString()))));
		list(accountantA, schoolB.getId().toString()).andExpect(status().isForbidden());
	}

	@Test
	void invalidHeaderIsRejected() throws Exception {
		User owner = data.user(RoleCode.OWNER, null);

		list(owner, "khong-phai-uuid").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("SCHOOL_HEADER_INVALID"));
	}

	@Test
	void meIgnoresSchoolHeader() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);

		mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(teacherA))
			.header(SchoolScope.HEADER, schoolB.getId().toString())).andExpect(status().isOk());
	}

	@Test
	void roleCheckFollowsSelectedSchool() throws Exception {
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		User teacherA = data.user(RoleCode.TEACHER, schoolA);
		User owner = data.user(RoleCode.OWNER, null);

		principalOnly(principalA, null).andExpect(status().isOk());
		principalOnly(teacherA, null).andExpect(status().isForbidden());
		principalOnly(owner, null).andExpect(status().isForbidden());
		principalAt(principalA, schoolA.getId(), null).andExpect(status().isOk());
		principalAt(principalA, schoolB.getId(), null).andExpect(status().isForbidden());
	}

	private ResultActions list(User user, String schoolHeader) throws Exception {
		return perform(user, "/api/v1/test-scope/holidays", schoolHeader);
	}

	private ResultActions byId(User user, UUID id, String schoolHeader) throws Exception {
		return perform(user, "/api/v1/test-scope/holidays/" + id, schoolHeader);
	}

	private ResultActions principalOnly(User user, String schoolHeader) throws Exception {
		return perform(user, "/api/v1/test-scope/principal-only", schoolHeader);
	}

	private ResultActions principalAt(User user, UUID schoolId, String schoolHeader) throws Exception {
		return perform(user, "/api/v1/test-scope/principal-at/" + schoolId, schoolHeader);
	}

	private ResultActions perform(User user, String url, String schoolHeader) throws Exception {
		var request = get(url).header(HttpHeaders.AUTHORIZATION, bearer(user));
		if (schoolHeader != null) {
			request.header(SchoolScope.HEADER, schoolHeader);
		}
		return mvc.perform(request);
	}

	/** Ngày ngẫu nhiên để không trùng UNIQUE (school_id, holiday_date) giữa các test. */
	private static LocalDate randomDate() {
		return LocalDate.of(2100, 1, 1).plusDays(ThreadLocalRandom.current().nextInt(0, 300_000));
	}

	@RestController
	static class HolidayProbeController {

		private final HolidayRepository holidays;

		HolidayProbeController(HolidayRepository holidays) {
			this.holidays = holidays;
		}

		@GetMapping("/api/v1/test-scope/holidays")
		List<String> list() {
			return holidays.findAllByOrderByHolidayDate().stream().map(h -> h.getId().toString()).toList();
		}

		@GetMapping("/api/v1/test-scope/holidays/{id}")
		String byId(@PathVariable UUID id) {
			return holidays.findById(id).map(h -> h.getId().toString())
				.orElseThrow(() -> ApiException.notFound("Không tìm thấy ngày nghỉ."));
		}

		@GetMapping("/api/v1/test-scope/principal-only")
		@PreAuthorize("@perm.hasRole('PRINCIPAL')")
		String principalOnly() {
			return "ok";
		}

		@GetMapping("/api/v1/test-scope/principal-at/{schoolId}")
		@PreAuthorize("@perm.hasRoleAt('PRINCIPAL', #schoolId)")
		String principalAt(@PathVariable UUID schoolId) {
			return "ok";
		}

	}

}
