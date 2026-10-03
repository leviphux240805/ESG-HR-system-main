package com.preschool.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.RoleCode;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Bảng quyền: gọi mọi endpoint {@code /api/v1} bằng từng vai trò của seed dev ở Trường A và đối chiếu với ma trận
 * quyền trong docs/thiet-ke.md ({@link #EXPECTED}). Endpoint mới chưa có trong bảng làm test đỏ.
 * <ul>
 * <li>Vai trò được phép: GET phải 2xx (dòng có {@code *}: chấp nhận 404 vì id ngẫu nhiên/không có dữ liệu), lệnh
 * ghi không được 401/403 (thân rỗng nên 400/404/409 là bình thường).</li>
 * <li>Vai trò không được phép: GET phải 403/404, lệnh ghi không được 2xx.</li>
 * <li>X = hiệu trưởng tổ chức khác gửi header Trường A: luôn bị chặn, trừ endpoint "của tôi".</li>
 * </ul>
 * Kết quả đầy đủ ghi ra {@code target/permission-matrix.tsv}.
 */
@TestPropertySource(properties = "spring.flyway.locations=classpath:db/migration,classpath:db/dev")
class PermissionMatrixTests extends ApiTestSupport {

	static final String A = "00000000-0000-0000-0000-00000000000a";

	static final List<String> ROLES = List.of("X", "S", "K", "N", "T", "ACC", "VP", "P");

	/** Phương thức đường dẫn | vai trò được phép (ALL = mọi vai trò của trường, ME = ALL + X) [*]. */
	static final String EXPECTED = """
			GET /api/v1/accounts | P
			GET /api/v1/age-groups | ALL
			GET /api/v1/approvals | ALL
			GET /api/v1/attendance/configs | ALL
			GET /api/v1/attendance/discrepancies | P VP ACC
			GET /api/v1/attendance/months/{month}/export | P VP ACC
			GET /api/v1/attendance/staff | P VP ACC
			GET /api/v1/attendance/staff/{staffId}/{date} | P VP ACC
			GET /api/v1/cash-categories | P ACC
			GET /api/v1/cash-entries | P ACC
			GET /api/v1/cash-entries/summary | P ACC
			GET /api/v1/cash-entries/{id}/file-url | P ACC *
			GET /api/v1/checkups/{id}/file-url | P VP T N *
			GET /api/v1/children | P VP ACC T N
			GET /api/v1/children/{childId}/discounts | P ACC
			GET /api/v1/children/{childId}/fee-items | P ACC
			GET /api/v1/children/{childId}/health | P VP T N
			GET /api/v1/children/{childId}/invoices | P ACC
			GET /api/v1/children/{id} | P VP ACC T N
			GET /api/v1/children/{id}/files/{fileId}/url | P VP ACC T N *
			GET /api/v1/classes | P VP ACC T N K
			GET /api/v1/classes/{classId}/measurements | P VP T N
			GET /api/v1/classes/{id} | P VP ACC T N K
			GET /api/v1/classes/{id}/attendance | P VP ACC T N
			GET /api/v1/classes/{id}/attendance/month | P VP ACC T N
			GET /api/v1/classes/{id}/attendance/month/export | P VP ACC T N
			GET /api/v1/dishes | P VP T N K
			GET /api/v1/document-types | ALL
			GET /api/v1/fee-schedules | P ACC
			GET /api/v1/fee-types | P ACC
			GET /api/v1/files/{id}/download-url | ALL *
			GET /api/v1/finance/configs | P ACC
			GET /api/v1/guardians | P VP
			GET /api/v1/health-logs | P VP T N
			GET /api/v1/holidays | P VP ACC
			GET /api/v1/invoices | P ACC
			GET /api/v1/invoices/export | P ACC
			GET /api/v1/invoices/summary | P ACC
			GET /api/v1/invoices/{id} | P ACC
			GET /api/v1/invoices/{id}/pdf | P ACC
			GET /api/v1/leave-requests | ALL
			GET /api/v1/leave-requests/calendar | P VP ACC
			GET /api/v1/leave-requests/{id}/file-url | P VP ACC N *
			GET /api/v1/library/documents | ALL
			GET /api/v1/library/documents/{id} | ALL *
			GET /api/v1/library/documents/{id}/readers | P VP ACC *
			GET /api/v1/library/documents/{id}/versions/{versionNo}/download-url | ALL *
			GET /api/v1/library/folders | ALL
			GET /api/v1/me | ME
			GET /api/v1/me/attendance | ME *
			GET /api/v1/me/change-requests | ME *
			GET /api/v1/me/leave-balance | ME *
			GET /api/v1/me/leave-requests | ME *
			GET /api/v1/me/library/documents | ME
			GET /api/v1/me/payslips | ME
			GET /api/v1/me/staff | ME *
			GET /api/v1/me/tasks | ME *
			GET /api/v1/menus/allergy-warnings | P VP T N K
			GET /api/v1/menus/week | P VP T N K
			GET /api/v1/notifications | ALL
			GET /api/v1/notifications/unread-count | ALL
			GET /api/v1/payroll/params | ALL
			GET /api/v1/payroll/periods/{month} | P ACC
			GET /api/v1/payroll/periods/{month}/export | P ACC
			GET /api/v1/payroll/records/{id} | P ACC *
			GET /api/v1/payroll/records/{id}/pdf | P ACC *
			GET /api/v1/receivables | P ACC
			GET /api/v1/receivables/summary | P ACC
			GET /api/v1/reports/dashboard | P VP ACC
			GET /api/v1/reports/{name}/export | P VP
			GET /api/v1/school-years | ALL
			GET /api/v1/schools | ALL
			GET /api/v1/staff | P VP ACC
			GET /api/v1/staff/change-requests | ALL
			GET /api/v1/staff/expiring-documents | P VP ACC
			GET /api/v1/staff/export | P VP ACC
			GET /api/v1/staff/summary | P VP ACC
			GET /api/v1/staff/{id} | P VP ACC
			GET /api/v1/staff/{staffId}/certificates | P VP ACC
			GET /api/v1/staff/{staffId}/contracts | P VP ACC
			GET /api/v1/staff/{staffId}/dependents | P VP ACC
			GET /api/v1/staff/{staffId}/documents | P VP ACC
			GET /api/v1/staff/{staffId}/files/{fileId}/download-url | P VP ACC *
			GET /api/v1/staff/{staffId}/history | P VP ACC
			GET /api/v1/staff/{staffId}/salary-configs | P ACC
			GET /api/v1/staff/{staffId}/trainings | P VP ACC
			GET /api/v1/tasks | ALL
			GET /api/v1/tasks/{id} | P VP N
			GET /api/v1/tasks/{id}/files/{fileId}/download-url | P VP N *
			GET /api/v1/today | P VP
			POST /api/v1/accounts | P
			POST /api/v1/accounts/{id}/lock | P
			POST /api/v1/accounts/{id}/password | P
			PUT /api/v1/accounts/{id}/roles | P
			POST /api/v1/accounts/{id}/unlock | P
			PUT /api/v1/age-groups/{id} | P
			POST /api/v1/approvals/{type}/{id}/approve | P VP
			POST /api/v1/approvals/{type}/{id}/reject | P VP
			POST /api/v1/attendance/configs | P VP
			POST /api/v1/attendance/discrepancies/resolve | P VP
			POST /api/v1/attendance/imports | P VP
			POST /api/v1/attendance/months/{month}/lock | P VP
			POST /api/v1/attendance/months/{month}/unlock | P
			PUT /api/v1/attendance/staff/{staffId}/{date} | P VP
			POST /api/v1/cash-categories | P ACC
			PUT /api/v1/cash-categories/{id} | P ACC
			POST /api/v1/cash-entries | P ACC
			PUT /api/v1/cash-entries/{id} | P ACC
			DELETE /api/v1/cash-entries/{id} | P ACC
			DELETE /api/v1/checkups/{id} | P VP N
			POST /api/v1/children | P VP
			POST /api/v1/children/{childId}/checkups | P VP N
			POST /api/v1/children/{childId}/discounts | P ACC
			PUT /api/v1/children/{childId}/discounts/{discountId} | P ACC
			DELETE /api/v1/children/{childId}/discounts/{discountId} | P ACC
			POST /api/v1/children/{childId}/fee-items | P ACC
			PUT /api/v1/children/{childId}/fee-items/{itemId} | P ACC
			DELETE /api/v1/children/{childId}/fee-items/{itemId} | P ACC
			PUT /api/v1/children/{id} | P VP
			DELETE /api/v1/children/{id} | P VP
			POST /api/v1/children/{id}/documents | P VP
			DELETE /api/v1/children/{id}/documents/{documentId} | P VP
			POST /api/v1/children/{id}/guardians | P VP
			PUT /api/v1/children/{id}/guardians/{linkId} | P VP
			DELETE /api/v1/children/{id}/guardians/{linkId} | P VP
			POST /api/v1/children/{id}/status | P VP
			POST /api/v1/children/{id}/transfer | P VP
			POST /api/v1/classes | P VP
			PUT /api/v1/classes/{classId}/measurements | P VP T N
			PUT /api/v1/classes/{id} | P VP
			DELETE /api/v1/classes/{id} | P VP
			PUT /api/v1/classes/{id}/attendance | P VP T
			POST /api/v1/classes/{id}/attendance/lock | P VP T
			POST /api/v1/classes/{id}/attendance/unlock | P VP
			POST /api/v1/classes/{id}/teachers | P VP
			POST /api/v1/classes/{id}/teachers/{assignmentId}/end | P VP
			POST /api/v1/dishes | P VP N K
			PUT /api/v1/dishes/{id} | P VP N K
			DELETE /api/v1/dishes/{id} | P VP N K
			POST /api/v1/fee-schedules | P ACC
			DELETE /api/v1/fee-schedules/{id} | P ACC
			POST /api/v1/fee-types | P
			PUT /api/v1/fee-types/{id} | P
			POST /api/v1/files/upload-url | ALL
			POST /api/v1/files/{id}/complete | ALL
			POST /api/v1/finance/configs | P ACC
			POST /api/v1/health-logs | P VP T N
			PUT /api/v1/health-logs/{id} | P VP T N
			DELETE /api/v1/health-logs/{id} | P VP T N
			POST /api/v1/health-logs/{id}/notify-parent | P VP T N
			POST /api/v1/holidays | P VP
			DELETE /api/v1/holidays/{id} | P VP
			POST /api/v1/invoices/generate | P ACC
			POST /api/v1/invoices/issue | P ACC
			POST /api/v1/invoices/{id}/cancel | P ACC
			POST /api/v1/invoices/{id}/issue | P ACC
			POST /api/v1/invoices/{id}/payments | P ACC
			POST /api/v1/invoices/{id}/payments/{paymentId}/void | P ACC
			POST /api/v1/leave-requests/approve | P VP
			POST /api/v1/leave-requests/{id}/approve | P VP
			POST /api/v1/leave-requests/{id}/reject | P VP
			POST /api/v1/library/documents | P VP ACC
			PUT /api/v1/library/documents/{id} | P VP ACC
			DELETE /api/v1/library/documents/{id} | P VP ACC
			POST /api/v1/library/documents/{id}/ack | ALL
			POST /api/v1/library/documents/{id}/remind | P VP ACC
			POST /api/v1/library/documents/{id}/versions | P VP ACC
			POST /api/v1/library/folders | P VP ACC
			PUT /api/v1/library/folders/{id} | P VP ACC
			DELETE /api/v1/library/folders/{id} | P VP ACC
			POST /api/v1/me/change-requests | ME
			POST /api/v1/me/leave-requests | ME
			POST /api/v1/me/leave-requests/{id}/cancel | ME
			DELETE /api/v1/measurements/{id} | P VP T N
			POST /api/v1/menus/copy | P VP N K
			PUT /api/v1/menus/week | P VP N K
			POST /api/v1/menus/{id}/publish | P VP N K
			POST /api/v1/menus/{id}/unpublish | P VP N K
			POST /api/v1/notifications/read-all | ALL
			POST /api/v1/notifications/{id}/read | ALL
			POST /api/v1/payroll/periods/{month}/approve | P
			POST /api/v1/payroll/periods/{month}/calculate | P ACC
			POST /api/v1/payroll/periods/{month}/pay | P ACC
			POST /api/v1/payroll/periods/{month}/reopen | P
			PUT /api/v1/payroll/records/{id} | P ACC
			POST /api/v1/school-years | P
			PUT /api/v1/school-years/{id} | P
			POST /api/v1/school-years/{id}/current | P
			POST /api/v1/schools | P
			PUT /api/v1/schools/{id} | P
			POST /api/v1/schools/{id}/activate | P
			POST /api/v1/schools/{id}/deactivate | P
			POST /api/v1/staff | P VP
			POST /api/v1/staff/change-requests/{id}/approve | P VP ACC
			POST /api/v1/staff/change-requests/{id}/reject | P VP ACC
			POST /api/v1/staff/check-duplicates | P VP ACC
			PUT /api/v1/staff/{id} | P VP
			PUT /api/v1/staff/{staffId}/bank | P
			POST /api/v1/staff/{staffId}/certificates | P VP
			PUT /api/v1/staff/{staffId}/certificates/{id} | P VP
			DELETE /api/v1/staff/{staffId}/certificates/{id} | P VP
			POST /api/v1/staff/{staffId}/contracts | P VP
			PUT /api/v1/staff/{staffId}/contracts/{contractId} | P VP
			DELETE /api/v1/staff/{staffId}/contracts/{contractId} | P VP
			POST /api/v1/staff/{staffId}/dependents | P VP
			PUT /api/v1/staff/{staffId}/dependents/{id} | P VP
			DELETE /api/v1/staff/{staffId}/dependents/{id} | P VP
			POST /api/v1/staff/{staffId}/documents | P VP
			DELETE /api/v1/staff/{staffId}/documents/{documentId} | P VP
			POST /api/v1/staff/{staffId}/salary-configs | P
			POST /api/v1/staff/{staffId}/terminate | P VP
			POST /api/v1/staff/{staffId}/trainings | P VP
			PUT /api/v1/staff/{staffId}/trainings/{id} | P VP
			DELETE /api/v1/staff/{staffId}/trainings/{id} | P VP
			POST /api/v1/staff/{staffId}/transfer | P VP
			POST /api/v1/substitutions | P VP
			POST /api/v1/tasks | P VP
			PUT /api/v1/tasks/{id} | P VP
			PUT /api/v1/tasks/{id}/assignees/me | N
			POST /api/v1/tasks/{id}/attachments | P VP N
			DELETE /api/v1/tasks/{id}/attachments/{attachmentId} | P VP
			POST /api/v1/tasks/{id}/checklist | P VP
			PUT /api/v1/tasks/{id}/checklist/{itemId} | P VP N
			DELETE /api/v1/tasks/{id}/checklist/{itemId} | P VP
			POST /api/v1/tasks/{id}/comments | P VP N
			PATCH /api/v1/classes/{id}/archive | P VP
			PATCH /api/v1/tasks/{id}/status | P VP N
			""";

	/** Lệnh làm đổi trạng thái dùng chung (khóa tài khoản giáo viên, ngừng Trường A): chạy cuối cùng. */
	static final List<String> LAST = List.of("POST /api/v1/accounts/{id}/lock", "POST /api/v1/schools/{id}/deactivate");

	@Autowired
	RequestMappingHandlerMapping mappings;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	com.preschool.school.repository.SchoolRepository schoolRepo;

	@Autowired
	com.preschool.staff.repository.StaffRepository staffRepo;

	final Map<String, String> tokens = new HashMap<>();

	final Map<String, String> identities = new LinkedHashMap<>();

	record Rule(Set<String> allowed, boolean lenient) {
	}

	static Map<String, Rule> rules() {
		Map<String, Rule> map = new LinkedHashMap<>();
		for (String line : EXPECTED.strip().split("\n")) {
			String[] parts = line.split("\\|");
			String spec = parts[1].strip();
			boolean lenient = spec.endsWith("*");
			Set<String> roles = new LinkedHashSet<>();
			for (String r : spec.replace("*", "").strip().split("\\s+")) {
				switch (r) {
					case "ALL" -> roles.addAll(List.of("P", "VP", "ACC", "T", "N", "K", "S"));
					case "ME" -> roles.addAll(ROLES);
					default -> roles.add(r);
				}
			}
			map.put(parts[0].strip(), new Rule(roles, lenient));
		}
		return map;
	}

	@Test
	void everyEndpointFollowsThePermissionMatrix() throws Exception {
		identities.put("P", "0900000001");
		identities.put("VP", "0900000004");
		identities.put("ACC", "0900000003");
		identities.put("T", "0900000005");
		identities.put("N", "0900000006");
		identities.put("K", data.link(data.user(RoleCode.KITCHEN, schoolA()), staff("106")).getEmail());
		identities.put("S", data.link(data.user(RoleCode.STAFF, schoolA()), staff("107")).getEmail());
		identities.put("X", "0900000002");

		Map<String, Rule> rules = rules();
		Map<String, String> ids = fixtures();
		List<String> violations = new ArrayList<>();

		// Danh sách lọc theo người xem: giáo viên không thấy đơn nghỉ, việc của người khác
		assertThat(this.<Integer>read("GET", "/api/v1/leave-requests", "T", "$.totalElements")).isZero();
		assertThat(this.<Integer>read("GET", "/api/v1/leave-requests", "P", "$.totalElements")).isPositive();
		assertThat(this.<Integer>read("GET", "/api/v1/tasks", "T", "$.totalElements")).isZero();
		assertThat(this.<Integer>read("GET", "/api/v1/tasks", "N", "$.totalElements")).isPositive();
		assertThat(this.<Integer>read("GET", "/api/v1/staff/change-requests", "T", "$.totalElements")).isZero();


		List<String[]> endpoints = endpoints();
		Set<String> mapped = new LinkedHashSet<>();
		endpoints.forEach(e -> mapped.add(e[0] + " " + e[1]));
		mapped.stream().filter(k -> !rules.containsKey(k)).forEach(k -> violations.add(k + ": chưa có trong ma trận"));
		rules.keySet().stream().filter(k -> !mapped.contains(k)).forEach(k -> violations.add(k + ": không còn endpoint"));

		StringBuilder table = new StringBuilder("method\tpath\t" + String.join("\t", ROLES) + "\n");
		for (String[] e : endpoints) {
			String key = e[0] + " " + e[1];
			Rule rule = rules.get(key);
			if (rule == null) {
				continue;
			}
			boolean read = e[0].equals("GET");
			table.append(e[0]).append('\t').append(e[1]);
			for (String role : ROLES) {
				int status = call(e[0], resolve(e[1], ids) + (read ? query(e[1]) : ""), role);
				table.append('\t').append(status);
				boolean allowed = rule.allowed().contains(role);
				boolean ok;
				if (allowed) {
					ok = read ? status / 100 == 2 || (rule.lenient() && status == 404) : status != 401 && status != 403;
				}
				else {
					ok = read ? status == 403 || status == 404 : status / 100 != 2;
				}
				if (!ok) {
					violations.add("%s [%s] → %d (%s)".formatted(key, role, status, allowed ? "phải được phép" : "phải bị chặn"));
				}
			}
			table.append('\n');
		}
		Files.writeString(Path.of("target/permission-matrix.tsv"), table);

		assertThat(violations).as("Sai lệch so với ma trận quyền").isEmpty();
	}

	// ------------------------------------------------------------ hỗ trợ

	List<String[]> endpoints() {
		List<String[]> list = new ArrayList<>();
		mappings.getHandlerMethods().forEach((info, method) -> {
			for (String path : info.getPatternValues()) {
				if (path.startsWith("/api/v1/") && !path.startsWith("/api/v1/auth/")) {
					for (RequestMethod m : info.getMethodsCondition().getMethods()) {
						list.add(new String[] { m.name(), path });
					}
				}
			}
		});
		// GET trước, lệnh ghi sau, lệnh làm hỏng dữ liệu dùng chung cuối cùng
		list.sort((a, b) -> {
			int ra = rank(a), rb = rank(b);
			return ra != rb ? Integer.compare(ra, rb) : (a[1] + a[0]).compareTo(b[1] + b[0]);
		});
		return list;
	}

	static int rank(String[] e) {
		int last = LAST.indexOf(e[0] + " " + e[1]);
		return last >= 0 ? 2 + last : e[0].equals("GET") ? 0 : 1;
	}

	int call(String method, String url, String role) throws Exception {
		return perform(method, url, role).getStatus();
	}

	MockHttpServletResponse perform(String method, String url, String role) throws Exception {
		var req = request(HttpMethod.valueOf(method), url).header(HttpHeaders.AUTHORIZATION, token(role))
			.header(SchoolScope.HEADER, A);
		if (!method.equals("GET") && !method.equals("DELETE")) {
			req.contentType(MediaType.APPLICATION_JSON).content("{}");
		}
		return mvc.perform(req).andReturn().getResponse();
	}

	<T> T read(String method, String url, String role, String jsonPath) throws Exception {
		return JsonPath.read(perform(method, url, role).getContentAsString(), jsonPath);
	}

	String post(String url, String role, String body) throws Exception {
		var res = mvc.perform(request(HttpMethod.POST, url).header(HttpHeaders.AUTHORIZATION, token(role))
			.header(SchoolScope.HEADER, A).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse();
		assertThat(res.getStatus()).as(url + " " + res.getContentAsString()).isBetween(200, 299);
		return res.getContentAsString();
	}

	String token(String role) throws Exception {
		String identifier = identities.get(role);
		if (!tokens.containsKey(identifier)) {
			String body = mvc.perform(request(HttpMethod.POST, "/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"identifier\":\"%s\",\"password\":\"%s\"}".formatted(identifier, TestData.PASSWORD)))
				.andReturn().getResponse().getContentAsString();
			tokens.put(identifier, "Bearer " + JsonPath.read(body, "$.accessToken"));
		}
		return tokens.get(identifier);
	}

	/** Id thật cho biến đường dẫn: dữ liệu seed dev + vài bản ghi tạo qua API. */
	Map<String, String> fixtures() throws Exception {
		LocalDate today = LocalDate.now(TestData.VN);
		Map<String, String> m = new HashMap<>();
		m.put("accounts", "00000000-0000-0000-0000-000000000005");
		m.put("age-groups", one("SELECT id FROM age_groups WHERE organization_id = '00000000-0000-0000-0000-0000000000f0'"));
		m.put("cash-categories", one("SELECT id FROM cash_categories WHERE organization_id = '00000000-0000-0000-0000-0000000000f0'"));
		m.put("checkups", one("SELECT id FROM health_checkups WHERE school_id = '" + A + "'"));
		m.put("children", "00000000-0000-0000-0000-000000000801");
		m.put("classes", "00000000-0000-0000-0000-000000000701");
		m.put("dishes", one("SELECT id FROM dishes WHERE school_id = '" + A + "'"));
		m.put("fee-schedules", one("SELECT id FROM fee_schedules WHERE school_id = '" + A + "'"));
		m.put("fee-types", one("SELECT id FROM fee_types WHERE organization_id = '00000000-0000-0000-0000-0000000000f0'"));
		m.put("health-logs", one("SELECT id FROM health_logs WHERE school_id = '" + A + "'"));
		m.put("holidays", one("SELECT id FROM holidays WHERE school_id = '" + A + "'"));
		m.put("measurements", one("SELECT id FROM growth_measurements WHERE school_id = '" + A + "'"));
		m.put("menus", one("SELECT id FROM menus WHERE school_id = '" + A + "'"));
		m.put("school-years", "00000000-0000-0000-0000-0000000000a1");
		m.put("schools", A);
		m.put("staff", "00000000-0000-0000-0000-000000000105");

		post("/api/v1/invoices/generate", "P", "{\"month\":\"%s\"}".formatted(today.withDayOfMonth(1)));
		m.put("invoices", JsonPath.read(perform("GET", "/api/v1/invoices?month=" + today.withDayOfMonth(1), "P")
			.getContentAsString(), "$.items[0].id"));
		m.put("tasks", JsonPath.read(post("/api/v1/tasks", "P", """
				{"schoolId":"%s","title":"Kiểm tra quyền","priority":"LOW","assigneeStaffIds":["00000000-0000-0000-0000-000000000103"]}"""
			.formatted(A)), "$.id"));
		LocalDate day = today.plusDays(14);
		while (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
			day = day.plusDays(1);
		}
		m.put("leave-requests", JsonPath.read(post("/api/v1/me/leave-requests", "N", """
				{"leaveCode":"P","fromDate":"%s","toDate":"%s","halfDay":false,"reason":"Kiểm tra quyền"}"""
			.formatted(day, day)), "$.id"));
		return m;
	}

	String one(String sql) {
		List<String> ids = jdbc.queryForList(sql.replace("SELECT id", "SELECT id::text"), String.class);
		return ids.isEmpty() ? UUID.randomUUID().toString() : ids.getFirst();
	}

	static final Pattern VAR = Pattern.compile("\\{([^}]+)}");

	String resolve(String path, Map<String, String> ids) {
		String[] parts = path.split("/");
		StringBuilder out = new StringBuilder();
		LocalDate today = LocalDate.now(TestData.VN);
		for (int i = 1; i < parts.length; i++) {
			Matcher v = VAR.matcher(parts[i]);
			String value = parts[i];
			if (v.matches()) {
				value = switch (v.group(1)) {
					case "id" -> ids.getOrDefault(parts[i - 1], UUID.randomUUID().toString());
					case "childId" -> ids.get("children");
					case "classId" -> ids.get("classes");
					case "staffId" -> ids.get("staff");
					case "month" -> today.toString().substring(0, 7);
					case "date" -> today.toString();
					case "name" -> "children";
					case "type" -> "leave";
					case "versionNo" -> "1";
					default -> UUID.randomUUID().toString();
				};
			}
			out.append('/').append(value);
		}
		return out.toString();
	}

	static String query(String path) {
		LocalDate today = LocalDate.now(TestData.VN);
		String month = path.startsWith("/api/v1/invoices") ? today.withDayOfMonth(1).toString()
				: today.toString().substring(0, 7);
		return "?month=%s&date=%s&weekStart=%s&year=%d&phone=0900&classId=00000000-0000-0000-0000-000000000701"
			.formatted(month, today, today.with(DayOfWeek.MONDAY), today.getYear());
	}

	com.preschool.school.entity.School schoolA() {
		return schoolRepo.findById(UUID.fromString(A)).orElseThrow();
	}

	com.preschool.staff.entity.Staff staff(String suffix) {
		return staffRepo.findById(UUID.fromString("00000000-0000-0000-0000-000000000" + suffix)).orElseThrow();
	}

}
