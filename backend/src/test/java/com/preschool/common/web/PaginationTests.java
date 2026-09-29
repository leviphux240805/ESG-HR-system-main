package com.preschool.common.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.concurrent.ThreadLocalRandom;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.Holiday;
import com.preschool.school.entity.School;
import com.preschool.school.repository.HolidayRepository;

import org.junit.jupiter.api.Test;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Quy ước phân trang: kẹp size, định dạng PageResponse, và tổng số dòng cũng bị lọc theo cơ sở. */
@Import(PaginationTests.PagedProbeController.class)
class PaginationTests extends ApiTestSupport {

	@Autowired
	HolidayRepository holidays;

	@Test
	void pageSizeIsClampedAndResponseHasStandardShape() throws Exception {
		User owner = data.user(RoleCode.OWNER, null);

		mvc.perform(get("/api/v1/test-paging/holidays?page=0&size=500").header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.size").value(100))
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.items").isArray())
			.andExpect(jsonPath("$.totalElements").isNumber())
			.andExpect(jsonPath("$.totalPages").isNumber());
	}

	@Test
	void totalCountRespectsSchoolScope() throws Exception {
		School schoolA = data.school();
		School schoolB = data.school();
		for (int i = 0; i < 3; i++) {
			holidays.save(new Holiday(schoolB.getId(), randomDate(), "Nghỉ B " + i, true));
		}
		holidays.save(new Holiday(schoolA.getId(), randomDate(), "Nghỉ A", true));
		User owner = data.user(RoleCode.OWNER, null);

		// Chủ chuỗi chọn Cơ sở A: tổng số không tính 3 dòng của B (dòng dùng chung vẫn tính)
		String body = mvc
			.perform(get("/api/v1/test-paging/holidays?size=1").header(HttpHeaders.AUTHORIZATION, bearer(owner))
				.header("X-School-Id", schoolA.getId().toString()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items.length()").value(1))
			.andReturn().getResponse().getContentAsString();
		long scopedTotal = JsonPath.<Number>read(body, "$.totalElements").longValue();
		long allForA = holidays.findAll().stream()
			.filter(h -> h.getSchoolId() == null || h.getSchoolId().equals(schoolA.getId()))
			.count();
		assertThat(scopedTotal).isEqualTo(allForA);
	}

	@Test
	void meExposesStaffLink() throws Exception {
		User owner = data.user(RoleCode.OWNER, null);

		mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.staffId").doesNotExist());
	}

	private static LocalDate randomDate() {
		return LocalDate.of(2100, 1, 1).plusDays(ThreadLocalRandom.current().nextInt(0, 300_000));
	}

	@RestController
	static class PagedProbeController {

		private final HolidayRepository holidays;

		PagedProbeController(HolidayRepository holidays) {
			this.holidays = holidays;
		}

		@GetMapping("/api/v1/test-paging/holidays")
		PageResponse<String> list(@ParameterObject Pageable pageable) {
			return PageResponse.of(holidays.findAll(pageable), h -> h.getId().toString());
		}

	}

}
