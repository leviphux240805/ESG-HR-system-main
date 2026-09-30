package com.preschool.staff.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Giấy tờ sắp hết hạn của nhân viên đang làm: hợp đồng hiện hành, chứng chỉ, và bản hiện hành (mới nhất theo loại)
 * của giấy tờ có hạn. Native SQL nên KHÔNG qua Hibernate filter: phạm vi cơ sở truyền vào tường minh
 * ({@code schoolIds} rỗng = mọi cơ sở, chỉ dùng cho job nền hoặc cấp chuỗi xem "Tất cả cơ sở").
 */
@Component
public class StaffExpiryQuery {

	/** Loại giấy tờ; `tab` là tab hồ sơ nhân viên hiển thị loại này. */
	public enum Kind {

		CONTRACT("contracts"), CERTIFICATE("qualifications"), DOCUMENT("documents");

		private final String tab;

		Kind(String tab) {
			this.tab = tab;
		}

		public String tab() {
			return tab;
		}

	}

	public record Item(Kind kind, UUID recordId, UUID staffId, String staffCode, String staffName, UUID schoolId,
			String title, LocalDate expiryDate) {
	}

	private static final String FROM_ITEMS = """
			FROM (
			  SELECT 'CONTRACT' AS kind, c.id AS record_id, c.staff_id, c.end_date AS expiry_date,
			         'Hợp đồng ' || coalesce(c.contract_no, '') AS title
			  FROM (SELECT DISTINCT ON (staff_id) * FROM staff_contracts ORDER BY staff_id, start_date DESC) c
			  WHERE c.end_date IS NOT NULL
			  UNION ALL
			  SELECT 'CERTIFICATE', ce.id, ce.staff_id, ce.expiry_date, ce.name
			  FROM staff_certificates ce WHERE ce.expiry_date IS NOT NULL
			  UNION ALL
			  SELECT 'DOCUMENT', d.id, d.staff_id, d.expiry_date, t.name
			  FROM (SELECT DISTINCT ON (staff_id, document_type_id) * FROM staff_documents
			        ORDER BY staff_id, document_type_id, created_at DESC) d
			  JOIN document_types t ON t.id = d.document_type_id
			  WHERE d.expiry_date IS NOT NULL
			) x
			JOIN staff s ON s.id = x.staff_id
			WHERE s.deleted_at IS NULL AND s.status = 'ACTIVE'
			  AND x.expiry_date BETWEEN :from AND :to
			  AND (:allSchools OR s.school_id IN (:schoolIds))
			  AND (CAST(:kind AS varchar) IS NULL OR x.kind = CAST(:kind AS varchar))
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public StaffExpiryQuery(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<Item> find(Set<UUID> schoolIds, LocalDate from, LocalDate to, Kind kind, int limit, long offset) {
		String sql = "SELECT x.kind, x.record_id, x.staff_id, s.staff_code, s.full_name, s.school_id, x.title, "
				+ "x.expiry_date " + FROM_ITEMS
				+ " ORDER BY x.expiry_date, s.full_name LIMIT :limit OFFSET :offset";
		return jdbc.query(sql, params(schoolIds, from, to, kind).addValue("limit", limit).addValue("offset", offset),
				StaffExpiryQuery::map);
	}

	public long count(Set<UUID> schoolIds, LocalDate from, LocalDate to, Kind kind) {
		String sql = "SELECT count(*) " + FROM_ITEMS;
		Long total = jdbc.queryForObject(sql, params(schoolIds, from, to, kind), Long.class);
		return total == null ? 0 : total;
	}

	private static MapSqlParameterSource params(Set<UUID> schoolIds, LocalDate from, LocalDate to, Kind kind) {
		boolean all = schoolIds == null;
		return new MapSqlParameterSource().addValue("from", from)
			.addValue("to", to)
			.addValue("allSchools", all)
			// IN () rỗng không hợp lệ: dùng UUID không thuộc cơ sở nào
			.addValue("schoolIds", all || schoolIds.isEmpty() ? List.of(new UUID(0, 0)) : schoolIds)
			.addValue("kind", kind == null ? null : kind.name());
	}

	private static Item map(ResultSet rs, int row) throws SQLException {
		return new Item(Kind.valueOf(rs.getString("kind")), rs.getObject("record_id", UUID.class),
				rs.getObject("staff_id", UUID.class), rs.getString("staff_code"), rs.getString("full_name"),
				rs.getObject("school_id", UUID.class), rs.getString("title").trim(),
				rs.getObject("expiry_date", LocalDate.class));
	}

}
