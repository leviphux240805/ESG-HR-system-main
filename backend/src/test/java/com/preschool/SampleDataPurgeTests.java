package com.preschool;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.sql.Statement;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

@IntegrationTest
class SampleDataPurgeTests {

	private static final String SCHEMA = "sample_purge_check";

	@Autowired
	DataSource dataSource;

	@Test
	void purgesDevOrganizationsTwiceAndKeepsPbcSchools() throws Exception {
		Flyway.configure()
			.dataSource(dataSource)
			.schemas(SCHEMA)
			.createSchemas(true)
			.locations("classpath:db/migration", "classpath:db/dev")
			.load()
			.migrate();

		JdbcTemplate jdbc = new JdbcTemplate(dataSource);
		assertThat(count(jdbc, "SELECT count(*) FROM " + SCHEMA + ".schools WHERE code LIKE 'CS-%' OR code = 'SM-1'")).isEqualTo(4);

		String script = Files.readString(Path.of("scripts", "purge-sample-data.sql"));
		String startMarker = "DO $purge$";
		String endMarker = "$purge$;";
		int start = script.indexOf(startMarker);
		int end = script.lastIndexOf(endMarker);
		assertThat(start).isNotNegative();
		assertThat(end).isGreaterThan(start);
		String purgeBlock = script.substring(start, end + endMarker.length());

		executeInSchema(jdbc, purgeBlock);
		executeInSchema(jdbc, purgeBlock);

		assertThat(count(jdbc, "SELECT count(*) FROM " + SCHEMA + ".schools WHERE code LIKE 'CS-%' OR code = 'SM-1'")).isZero();
		assertThat(count(jdbc, "SELECT count(*) FROM " + SCHEMA + ".schools WHERE organization_id = '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001' AND code IN ('PBC', 'PBC-PH1', 'PBC-PH2')")).isEqualTo(3);
		assertThat(count(jdbc, "SELECT count(*) FROM " + SCHEMA + ".organizations WHERE id IN ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000f2')")).isZero();
	}

	private static long count(JdbcTemplate jdbc, String sql) {
		return jdbc.queryForObject(sql, Long.class);
	}

	private static void executeInSchema(JdbcTemplate jdbc, String sql) {
		jdbc.execute((ConnectionCallback<Void>) connection -> {
			String previousSchema = connection.getSchema();
			try {
				connection.setSchema(SCHEMA);
				try (Statement statement = connection.createStatement()) {
					statement.execute("BEGIN");
					try {
						statement.execute(sql);
						statement.execute("COMMIT");
					}
					catch (SQLException e) {
						statement.execute("ROLLBACK");
						throw e;
					}
				}
			}
			finally {
				connection.setSchema(previousSchema);
			}
			return null;
		});
	}

}