package com.preschool.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

class AuthTests extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Test
	void loginWithEmailSetsSessionRefreshCookie() throws Exception {
		User user = data.principal(data.school());

		MvcResult result = login(user.getEmail().toUpperCase(), false);

		String setCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
		assertThat(setCookie).startsWith("refresh_token=")
			.contains("HttpOnly", "SameSite=Strict", "Path=/api/v1/auth")
			.doesNotContain("Max-Age");
		assertThat(result.getResponse().getContentAsString()).contains("\"tokenType\":\"Bearer\"")
			.contains("\"expiresIn\":900");
		assertThat(users.findById(user.getId()).orElseThrow().getLastLoginAt()).isNotNull();
	}

	@Test
	void loginWithPhoneInAnyFormat() throws Exception {
		School school = data.school();
		String phone = "09" + String.valueOf(System.nanoTime()).substring(0, 8);
		data.user(RoleCode.TEACHER, school, phone);

		login(phone.substring(0, 4) + " " + phone.substring(4), false);
		login("+84 " + phone.substring(1), false);
	}

	@Test
	void rememberMeMakesCookiePersistent() throws Exception {
		User user = data.principal(data.school());

		String setCookie = login(user.getEmail(), true).getResponse().getHeader(HttpHeaders.SET_COOKIE);

		assertThat(setCookie).contains("Max-Age=604800");
	}

	@Test
	void wrongPasswordAndUnknownAccountLookTheSame() throws Exception {
		User user = data.principal(data.school());

		postLogin(user.getEmail(), "sai-mat-khau").andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
			.andExpect(jsonPath("$.detail").value("Email/số điện thoại hoặc mật khẩu không đúng."));
		postLogin("khong-ton-tai@test.local", TestData.PASSWORD).andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void disabledAccountCannotLogin() throws Exception {
		User user = data.user(RoleCode.STAFF, data.school());
		data.deactivate(user);

		postLogin(user.getEmail(), TestData.PASSWORD).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
	}

	@Test
	void blankLoginIsRejectedWithFieldErrors() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("identifier", "password")));
	}

	@Test
	void meForPrincipalListsAssignedSchoolsAndOrganization() throws Exception {
		School a = data.school();
		School b = data.school();
		School notMine = data.school();
		User principal = data.principal(a, b);

		mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(principal)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value(principal.getEmail()))
			.andExpect(jsonPath("$.organization.id").value(TestData.DEFAULT_ORG.toString()))
			.andExpect(jsonPath("$.roles[0].role").value("PRINCIPAL"))
			.andExpect(jsonPath("$.schools", hasSize(2)))
			.andExpect(jsonPath("$.schools[*].id", hasItem(a.getId().toString())))
			.andExpect(jsonPath("$.schools[*].id", hasItem(b.getId().toString())))
			.andExpect(jsonPath("$.schools[*].id", not(hasItem(notMine.getId().toString()))));
	}

	@Test
	void meForVicePrincipalShowsFunctionGroups() throws Exception {
		School a = data.school();
		data.school();
		User vice = data.vicePrincipal(a, FunctionGroup.CLASSROOM);

		mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(vice)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.schools", hasSize(1)))
			.andExpect(jsonPath("$.schools[0].id").value(a.getId().toString()))
			.andExpect(jsonPath("$.roles[0].schoolId").value(a.getId().toString()))
			.andExpect(jsonPath("$.roles[0].functionGroups[0]").value("CLASSROOM"));
	}

	@Test
	void meRequiresValidToken() throws Exception {
		mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer khong.hop.le"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
	}

	@Test
	void meRejectsTokenOfDeactivatedAccount() throws Exception {
		User user = data.principal(data.school());
		String bearer = bearer(user);
		data.deactivate(user);

		mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
	}

	@Test
	void refreshRotatesToken() throws Exception {
		User user = data.principal(data.school());
		Cookie first = refreshCookie(login(user.getEmail(), true));

		MvcResult refreshed = refresh(first).andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(header().string(HttpHeaders.SET_COOKIE, not(first.getValue())))
			.andReturn();
		Cookie second = refreshCookie(refreshed);

		assertThat(second.getValue()).isNotEqualTo(first.getValue());
		assertThat(refreshed.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=604800");
		refresh(second).andExpect(status().isOk());
	}

	@Test
	void reusingRotatedTokenRevokesWholeFamily() throws Exception {
		User user = data.principal(data.school());
		Cookie first = refreshCookie(login(user.getEmail(), false));
		Cookie second = refreshCookie(refresh(first).andExpect(status().isOk()).andReturn());
		// Giả lập token cũ đã bị thay thế từ lâu (ngoài khoảng ân hạn)
		jdbc.update("UPDATE refresh_tokens SET revoked_at = now() - interval '1 hour' WHERE revoked_at IS NOT NULL "
				+ "AND user_id = ?", user.getId());

		refresh(first).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("REFRESH_INVALID"));
		// Kẻ đánh cắp dùng lại token cũ → token mới của người dùng cũng bị thu hồi
		refresh(second).andExpect(status().isUnauthorized());
	}

	@Test
	void concurrentRefreshWithinGraceKeepsNewToken() throws Exception {
		User user = data.principal(data.school());
		Cookie first = refreshCookie(login(user.getEmail(), false));
		Cookie second = refreshCookie(refresh(first).andExpect(status().isOk()).andReturn());

		// Tab thứ hai gửi token cũ ngay sau đó
		refresh(first).andExpect(status().isUnauthorized());
		refresh(second).andExpect(status().isOk());
	}

	@Test
	void expiredOrMissingRefreshTokenIsRejected() throws Exception {
		User user = data.principal(data.school());
		Cookie cookie = refreshCookie(login(user.getEmail(), false));
		jdbc.update("UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = ?",
				user.getId());

		refresh(cookie).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("REFRESH_INVALID"));
	}

	@Test
	void logoutRevokesAndClearsCookie() throws Exception {
		User user = data.principal(data.school());
		Cookie cookie = refreshCookie(login(user.getEmail(), true));

		MvcResult result = mvc.perform(post("/api/v1/auth/logout").cookie(cookie))
			.andExpect(status().isNoContent())
			.andReturn();

		assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("refresh_token=;")
			.contains("Max-Age=0");
		refresh(cookie).andExpect(status().isUnauthorized());
		assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
				Integer.class, user.getId())).isZero();
		assertThat(jdbc.queryForObject("SELECT max(revoked_at) FROM refresh_tokens WHERE user_id = ?", Instant.class,
				user.getId())).isNotNull();
	}

	private ResultActions postLogin(String identifier, String password) throws Exception {
		return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"%s\",\"password\":\"%s\"}".formatted(identifier, password)));
	}

	private ResultActions refresh(Cookie cookie) throws Exception {
		return mvc.perform(post("/api/v1/auth/refresh").cookie(cookie));
	}

	private static Cookie refreshCookie(MvcResult result) {
		Cookie cookie = result.getResponse().getCookie("refresh_token");
		assertThat(cookie).as("cookie refresh_token").isNotNull();
		return new Cookie(cookie.getName(), cookie.getValue());
	}

}
