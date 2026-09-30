package com.preschool;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.preschool.account.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** Nền cho test API: MockMvc có Spring Security và hàm đăng nhập lấy access token thật. */
@IntegrationTest
public abstract class ApiTestSupport {

	@Autowired
	protected WebApplicationContext context;

	@Autowired
	protected TestData data;

	protected MockMvc mvc;

	@BeforeEach
	void setUpMockMvc() {
		mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	protected MvcResult login(String identifier, boolean rememberMe) throws Exception {
		return mvc
			.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"identifier":"%s","password":"%s","rememberMe":%s}"""
					.formatted(identifier, TestData.PASSWORD, rememberMe)))
			.andExpect(status().isOk())
			.andReturn();
	}

	/** Gọi API với tư cách `user` (đăng nhập thật), tùy chọn cơ sở đang chọn. */
	protected org.springframework.test.web.servlet.ResultActions as(User user,
			org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
		return as(user, request, null);
	}

	protected org.springframework.test.web.servlet.ResultActions as(User user,
			org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, java.util.UUID schoolId)
			throws Exception {
		request.header(org.springframework.http.HttpHeaders.AUTHORIZATION, bearer(user));
		if (schoolId != null) {
			request.header(com.preschool.security.SchoolScope.HEADER, schoolId.toString());
		}
		return mvc.perform(request);
	}

	/** Header Authorization cho người dùng (đăng nhập thật qua API). */
	protected String bearer(User user) throws Exception {
		String body = login(user.getEmail(), false).getResponse().getContentAsString();
		return "Bearer " + JsonPath.read(body, "$.accessToken");
	}

}
