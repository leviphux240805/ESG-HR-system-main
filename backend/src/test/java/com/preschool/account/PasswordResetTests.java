package com.preschool.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;

import jakarta.mail.BodyPart;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

class PasswordResetTests extends ApiTestSupport {

	private static final Pattern TOKEN = Pattern.compile("/reset-password\\?token=([A-Za-z0-9_-]+)");

	private static final String NEW_PASSWORD = "MatKhauMoi2026";

	@MockitoBean
	JavaMailSender mailSender;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void stubMimeMessage() {
		when(mailSender.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));
	}

	@Test
	void resetViaEmailLinkChangesPasswordAndLogsOutEverywhere() throws Exception {
		String phone = "08" + String.valueOf(System.nanoTime()).substring(0, 8);
		User user = data.user(RoleCode.TEACHER, data.school(), phone);
		Cookie oldSession = login(user.getEmail(), true).getResponse().getCookie("refresh_token");

		forgot(phone).andExpect(status().isNoContent());
		MimeMessage email = captureEmail();
		assertThat(email.getRecipients(Message.RecipientType.TO)[0].toString()).isEqualTo(user.getEmail());
		assertThat(email.getSubject()).isEqualTo("Đặt lại mật khẩu");
		String token = tokenFrom(email);

		reset(token, "ngan1").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("PASSWORD_TOO_WEAK"));
		reset(token, NEW_PASSWORD).andExpect(status().isNoContent());

		// Mật khẩu mới dùng được, mật khẩu cũ và phiên cũ thì không
		postLogin(user.getEmail(), NEW_PASSWORD).andExpect(status().isOk());
		postLogin(user.getEmail(), TestData.PASSWORD).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", oldSession.getValue())))
			.andExpect(status().isUnauthorized());
		// Link chỉ dùng một lần
		reset(token, "MatKhauKhac2026").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("RESET_TOKEN_INVALID"));
	}

	@Test
	void unknownOrDisabledAccountGetsSameAnswerButNoEmail() throws Exception {
		User disabled = data.user(RoleCode.STAFF, data.school());
		data.deactivate(disabled);

		forgot("khong-ton-tai@test.local").andExpect(status().isNoContent());
		forgot(disabled.getEmail()).andExpect(status().isNoContent());

		verify(mailSender, after(500).never()).send(any(MimeMessage.class));
	}

	@Test
	void repeatedRequestsAreThrottled() throws Exception {
		User user = data.principal(data.school());

		forgot(user.getEmail()).andExpect(status().isNoContent());
		forgot(user.getEmail()).andExpect(status().isNoContent());

		verify(mailSender, timeout(5000).times(1)).send(any(MimeMessage.class));
		verify(mailSender, after(500).times(1)).send(any(MimeMessage.class));
	}

	@Test
	void expiredOrBogusTokenIsRejected() throws Exception {
		User user = data.principal(data.school());
		forgot(user.getEmail()).andExpect(status().isNoContent());
		String token = tokenFrom(captureEmail());
		jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE user_id = ?",
				user.getId());

		reset(token, NEW_PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("RESET_TOKEN_INVALID"));
		reset("token-bia-dat", NEW_PASSWORD).andExpect(status().isBadRequest());
	}

	private ResultActions forgot(String identifier) throws Exception {
		return mvc.perform(post("/api/v1/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"%s\"}".formatted(identifier)));
	}

	private ResultActions reset(String token, String password) throws Exception {
		return mvc.perform(post("/api/v1/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
			.content("{\"token\":\"%s\",\"newPassword\":\"%s\"}".formatted(token, password)));
	}

	private ResultActions postLogin(String identifier, String password) throws Exception {
		return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"%s\",\"password\":\"%s\"}".formatted(identifier, password)));
	}

	private MimeMessage captureEmail() {
		ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
		verify(mailSender, timeout(5000)).send(captor.capture());
		return captor.getValue();
	}

	private static String tokenFrom(MimeMessage email) throws Exception {
		String text = plainText(email);
		Matcher matcher = TOKEN.matcher(text);
		assertThat(matcher.find()).as("link đặt lại mật khẩu trong email").isTrue();
		return matcher.group(1);
	}

	/** Lấy phần text/plain trong email nhiều phần. */
	private static String plainText(Part part) throws Exception {
		// Xét nội dung thật trước: email chưa qua send() thật nên header Content-Type chưa được cập nhật
		Object content = part.getContent();
		if (content instanceof String text) {
			return part.isMimeType("text/html") ? null : text;
		}
		if (content instanceof Multipart multipart) {
			for (int i = 0; i < multipart.getCount(); i++) {
				BodyPart child = multipart.getBodyPart(i);
				String text = plainText(child);
				if (text != null) {
					return text;
				}
			}
		}
		return null;
	}

}
