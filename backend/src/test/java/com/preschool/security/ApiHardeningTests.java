package com.preschool.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.TestData;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Kiểm tra đầu vào xấu trên mọi endpoint (hiệu trưởng, toàn quyền): JSON hỏng, chuỗi rất dài, sai kiểu, id không phải
 * UUID. Không được trả 5xx và không được lộ chi tiết kỹ thuật (tên lớp Java, stack trace, câu SQL).
 */
@TestPropertySource(properties = "spring.flyway.locations=classpath:db/migration,classpath:db/dev")
class ApiHardeningTests extends ApiTestSupport {

	static final String A = "00000000-0000-0000-0000-00000000000a";

	static final List<String> LEAKS = List.of("Exception", "\tat ", "at com.", "org.springframework", "org.hibernate",
			"SQL", "PSQL", "java.", "jakarta.", "trace");

	@Autowired
	RequestMappingHandlerMapping mappings;

	String token;

	MockHttpServletResponse call(String method, String url, String body) throws Exception {
		var req = request(HttpMethod.valueOf(method), url).header(HttpHeaders.AUTHORIZATION, token)
			.header(SchoolScope.HEADER, A);
		if (body != null) {
			req.contentType(MediaType.APPLICATION_JSON).content(body);
		}
		return mvc.perform(req).andReturn().getResponse();
	}

	@Test
	void badInputNeverCauses5xxOrLeaksInternals() throws Exception {
		String login = mvc.perform(request(HttpMethod.POST, "/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"0900000001\",\"password\":\"%s\"}".formatted(TestData.PASSWORD)))
			.andReturn().getResponse().getContentAsString();
		token = "Bearer " + JsonPath.read(login, "$.accessToken");

		String huge = "x".repeat(20_000);
		String hugeBody = """
				{"name":"%1$s","fullName":"%1$s","title":"%1$s","description":"%1$s","note":"%1$s","reason":"%1$s",
				 "content":"%1$s","phone":"%1$s","email":"%1$s","code":"%1$s","address":"%1$s","fileName":"%1$s",
				 "amount":-99999999999999999999,"capacity":-1,"month":"2026-13","date":"31/02/2026","fromDate":"x",
				 "sizeBytes":-5,"contentType":"application/x-msdownload","items":"khong-phai-mang","ids":[1,2]}"""
			.formatted(huge);

		List<String> problems = new ArrayList<>();
		List<String[]> endpoints = new ArrayList<>();
		mappings.getHandlerMethods().forEach((info, method) -> {
			for (String path : info.getPatternValues()) {
				if (path.startsWith("/api/v1/") && !path.startsWith("/api/v1/auth/")) {
					for (RequestMethod m : info.getMethodsCondition().getMethods()) {
						endpoints.add(new String[] { m.name(), path });
					}
				}
			}
		});
		// GET trước, sau đó lệnh ghi; không chạy lệnh ngừng trường/khóa tài khoản để phiên đăng nhập còn dùng được
		endpoints.removeIf(e -> e[1].endsWith("/deactivate") || e[1].endsWith("/lock") && e[1].contains("accounts"));
		endpoints.sort((a, b) -> Boolean.compare(!a[0].equals("GET"), !b[0].equals("GET")));

		for (String[] e : endpoints) {
			String validIds = e[1].replaceAll("\\{month}", "2026-09").replaceAll("\\{date}", "2026-09-15")
				.replaceAll("\\{name}", "children").replaceAll("\\{type}", "leave").replaceAll("\\{versionNo}", "1")
				.replaceAll("\\{[^}]+}", UUID.randomUUID().toString());
			String badIds = e[1].replaceAll("\\{[^}]+}", "khong-phai-id");
			List<String[]> cases = new ArrayList<>();
			cases.add(new String[] { badIds, null });
			if (e[0].equals("GET")) {
				cases.add(new String[] { validIds + "?month=2026-99&date=hom-nay&page=-1&size=100000&sort=khongco,desc"
						+ "&classId=abc&status=KHONG_CO&q=" + "%27%20OR%201%3D1--", null });
			}
			else if (!e[0].equals("DELETE")) {
				cases.add(new String[] { validIds, "{\"a\":" });
				cases.add(new String[] { validIds, "[]" });
				cases.add(new String[] { validIds, hugeBody });
			}
			for (String[] c : cases) {
				MockHttpServletResponse res = call(e[0], c[0], c[1]);
				String body = res.getContentAsString();
				String what = "%s %s %s".formatted(e[0], c[0].length() > 120 ? c[0].substring(0, 120) : c[0],
						c[1] == null ? "" : c[1].length() > 20 ? c[1].substring(0, 20) + "…" : c[1]);
				if (res.getStatus() >= 500) {
					problems.add(what + " → " + res.getStatus() + " " + body);
				}
				else if (res.getStatus() >= 400) {
					LEAKS.stream().filter(body::contains).findFirst()
						.ifPresent(l -> problems.add(what + " → lộ \"" + l + "\": " + body));
					String type = res.getContentType();
					if (type == null || !type.startsWith("application/problem+json")) {
						problems.add(what + " → " + res.getStatus() + " không phải problem+json: " + type);
					}
				}
			}
		}
		assertThat(problems).as("Đầu vào xấu gây lỗi máy chủ hoặc lộ chi tiết").isEmpty();
	}

}
