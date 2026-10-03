package com.preschool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import com.jayway.jsonpath.JsonPath;
import com.preschool.security.SchoolScope;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;

/**
 * Hiệu năng với dữ liệu lớn (test/resources/perf/seed.sql: 5 trường, 1.000 trẻ, 12 tháng điểm danh, chấm công, phiếu
 * thu, lương, cân đo): mỗi trang danh sách và báo cáo phải trả trong 2 giây, kể cả khi chọn "Tất cả trường", và số
 * câu SQL không tăng theo số dòng trả về (không N+1). Kết quả ghi ra target/performance.tsv.
 */
@TestPropertySource(properties = { "spring.flyway.locations=classpath:db/migration,classpath:db/dev",
		"spring.jpa.properties.hibernate.generate_statistics=true" })
class PerformanceTests extends ApiTestSupport {

	static final long LIMIT_MS = 2000;

	/** Ngưỡng câu SQL (Hibernate) cho một request; vượt là dấu hiệu truy vấn theo từng dòng. */
	static final long MAX_STATEMENTS = 15;

	@Autowired
	DataSource dataSource;

	@Autowired
	EntityManagerFactory emf;

	String token;

	@Test
	void listsAndReportsStayFastWithAYearOfData() throws Exception {
		try (var connection = dataSource.getConnection()) {
			ScriptUtils.executeSqlScript(connection, new ClassPathResource("perf/seed.sql"));
		}
		String login = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"identifier\":\"0900000001\",\"password\":\"%s\"}".formatted(TestData.PASSWORD)))
			.andReturn().getResponse().getContentAsString();
		token = "Bearer " + JsonPath.read(login, "$.accessToken");
		String school = jdbcOne("SELECT md5('perf-school-1')::uuid::text");
		String classId = jdbcOne("SELECT md5('perf-class-1-1')::uuid::text");

		List<String> paths = List.of("/api/v1/children?size=100", "/api/v1/children?size=20&q=Nguy%E1%BB%85n",
				"/api/v1/classes", "/api/v1/staff?size=100", "/api/v1/staff/summary", "/api/v1/staff/expiring-documents",
				"/api/v1/staff/export", "/api/v1/attendance/staff?month=2026-09", "/api/v1/attendance/discrepancies?month=2026-09",
				"/api/v1/attendance/months/2026-08/export", "/api/v1/leave-requests?size=100",
				"/api/v1/leave-requests?status=PENDING", "/api/v1/leave-requests/calendar?month=2026-09",
				"/api/v1/tasks?size=100", "/api/v1/invoices?month=2026-09-01&size=100", "/api/v1/invoices/summary?month=2026-09-01",
				"/api/v1/invoices/export?month=2026-09-01", "/api/v1/receivables?size=100", "/api/v1/receivables/summary",
				"/api/v1/cash-entries?size=100", "/api/v1/cash-entries/summary", "/api/v1/payroll/periods/2026-08",
				"/api/v1/payroll/periods/2026-08/export", "/api/v1/health-logs?size=100",
				"/api/v1/classes/" + classId + "/attendance/month?month=2026-09",
				"/api/v1/classes/" + classId + "/attendance/month/export?month=2026-09",
				"/api/v1/classes/" + classId + "/attendance", "/api/v1/classes/" + classId + "/measurements",
				"/api/v1/menus/week?weekStart=2026-09-14", "/api/v1/reports/dashboard", "/api/v1/reports/dashboard?date=2026-09-15",
				"/api/v1/reports/staff-attendance/export?month=2026-08", "/api/v1/reports/payroll/export?month=2026-08",
				"/api/v1/reports/receivables/export?month=2026-09", "/api/v1/reports/children/export?month=2026-09",
				"/api/v1/today", "/api/v1/approvals", "/api/v1/staff/change-requests", "/api/v1/notifications");

		Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
		List<String> slow = new ArrayList<>();
		StringBuilder report = new StringBuilder("path\tphạm vi\tstatus\tms\tsql\n");
		for (String path : paths) {
			// Phiếu thu, lương, chấm công, sổ điểm danh theo từng trường; còn lại thử cả "Tất cả trường"
			List<String> scopes = path.contains("/payroll/") || path.contains("/attendance/") || path.contains("/menus/")
					|| path.contains("/calendar") || path.contains("staff-attendance") ? List.of(school) : List.of(school, "");
			for (String scope : scopes) {
				call(path, scope); // làm nóng (JIT, cache kế hoạch truy vấn)
				stats.clear();
				long start = System.nanoTime();
				MockHttpServletResponse res = call(path, scope);
				long ms = (System.nanoTime() - start) / 1_000_000;
				long statements = stats.getPrepareStatementCount();
				String label = scope.isEmpty() ? "tất cả" : "một trường";
				report.append("%s\t%s\t%d\t%d\t%d%n".formatted(path, label, res.getStatus(), ms, statements));
				if (res.getStatus() != 200) {
					slow.add("%s (%s) → %d %s".formatted(path, label, res.getStatus(), res.getContentAsString()));
				}
				if (ms > LIMIT_MS) {
					slow.add("%s (%s) chậm: %d ms".formatted(path, label, ms));
				}
				if (statements > MAX_STATEMENTS) {
					slow.add("%s (%s) %d câu SQL".formatted(path, label, statements));
				}
			}
		}
		Files.writeString(Path.of("target/performance.tsv"), report);
		assertThat(slow).as("Trang chậm, lỗi hoặc N+1").isEmpty();
	}

	MockHttpServletResponse call(String path, String school) throws Exception {
		var request = get(path).header(HttpHeaders.AUTHORIZATION, token);
		if (!school.isEmpty()) {
			request.header(SchoolScope.HEADER, school);
		}
		return mvc.perform(request).andReturn().getResponse();
	}

	String jdbcOne(String sql) {
		return new org.springframework.jdbc.core.JdbcTemplate(dataSource).queryForObject(sql, String.class);
	}

}
