package com.preschool.common.error;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.preschool.IntegrationTest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;

@IntegrationTest
@Import(ErrorHandlingTests.ErrorController.class)
class ErrorHandlingTests {

	private static final MediaType PROBLEM = MediaType.APPLICATION_PROBLEM_JSON;

	@Autowired
	WebApplicationContext context;

	MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	@Test
	void unauthenticatedRequestGetsVietnameseProblem() throws Exception {
		mvc.perform(get("/api/v1/test-errors/not-found"))
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(PROBLEM))
			.andExpect(jsonPath("$.title").value("Chưa đăng nhập"))
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
			.andExpect(jsonPath("$.instance").value("/api/v1/test-errors/not-found"));
	}

	@Test
	void apiExceptionKeepsItsMessageAndCode() throws Exception {
		mvc.perform(get("/api/v1/test-errors/not-found").with(user("u")))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(PROBLEM))
			.andExpect(jsonPath("$.title").value("Không tìm thấy"))
			.andExpect(jsonPath("$.detail").value("Không tìm thấy trẻ."))
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void validationErrorsListEachFieldInVietnamese() throws Exception {
		mvc.perform(post("/api/v1/test-errors/validate").with(user("u"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"\",\"email\":\"khong-phai-email\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(PROBLEM))
			.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
			.andExpect(jsonPath("$.errors[?(@.field=='name')].message").value("không được để trống"))
			.andExpect(jsonPath("$.errors[?(@.field=='email')].message").value("email không hợp lệ"));
	}

	@Test
	void malformedJsonIsTranslated() throws Exception {
		mvc.perform(post("/api/v1/test-errors/validate").with(user("u"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("{không phải json"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("Dữ liệu gửi lên không đúng định dạng."));
	}

	@Test
	void unknownPathIsTranslated() throws Exception {
		mvc.perform(get("/api/v1/khong-ton-tai").with(user("u")))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Không tìm thấy đường dẫn yêu cầu."));
	}

	@Test
	void accessDeniedBecomes403() throws Exception {
		mvc.perform(get("/api/v1/test-errors/denied").with(user("u")))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void unexpectedErrorHidesInternals() throws Exception {
		mvc.perform(get("/api/v1/test-errors/boom").with(user("u")))
			.andExpect(status().isInternalServerError())
			.andExpect(jsonPath("$.detail").value("Đã xảy ra lỗi hệ thống, vui lòng thử lại sau."))
			.andExpect(content().string(not(containsString("bí mật nội bộ"))));
	}

	record Payload(@NotBlank String name, @Email String email) {
	}

	@RestController
	static class ErrorController {

		@GetMapping("/api/v1/test-errors/not-found")
		String notFound() {
			throw ApiException.notFound("Không tìm thấy trẻ.");
		}

		@PostMapping("/api/v1/test-errors/validate")
		String validate(@Valid @RequestBody Payload payload) {
			return "ok";
		}

		@GetMapping("/api/v1/test-errors/denied")
		String denied() {
			throw new AccessDeniedException("x");
		}

		@GetMapping("/api/v1/test-errors/boom")
		String boom() {
			throw new IllegalStateException("bí mật nội bộ");
		}

	}

}
