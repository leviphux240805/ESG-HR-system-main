package com.preschool.document.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * "Người cần đọc" văn bản: tài khoản đang hoạt động gắn với nhân viên đang làm, thuộc phạm vi cơ sở của văn bản
 * (rỗng = mọi cơ sở) và có một trong các vai trò của văn bản (rỗng = mọi vai trò) tại cơ sở của nhân viên. Đã đọc =
 * có xác nhận phiên bản ≥ {@code ack_version_no}. Native SQL, không qua Hibernate filter: chỉ gọi sau khi đã kiểm tra
 * quyền trên văn bản.
 */
@Component
public class LibraryReaderQuery {

	public record Reader(UUID staffId, UUID userId, String staffCode, String fullName, String email, UUID schoolId,
			Instant acknowledgedAt) {
	}

	public record Stats(long required, long acknowledged) {
	}

	private static final String READERS = """
			FROM library_documents d
			JOIN staff s ON s.deleted_at IS NULL AND s.status = 'ACTIVE'
			     AND (d.school_id IS NULL OR s.school_id = d.school_id)
			JOIN users u ON u.staff_id = s.id AND u.is_active
			LEFT JOIN LATERAL (
			    SELECT max(a.acknowledged_at) AS acknowledged_at FROM document_acks a
			    WHERE a.document_id = d.id AND a.staff_id = s.id AND a.version_no >= coalesce(d.ack_version_no, 1)
			) ack ON true
			WHERE (cardinality(d.visible_roles) = 0 OR EXISTS (
			    SELECT 1 FROM user_roles ur
			    WHERE ur.user_id = u.id AND ur.role_code = ANY (d.visible_roles)
			      AND (ur.school_id IS NULL OR ur.school_id = s.school_id)))
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public LibraryReaderQuery(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	/** Người cần đọc; {@code acknowledged}: true = đã đọc, false = chưa đọc, null = tất cả. */
	public List<Reader> readers(UUID documentId, Boolean acknowledged) {
		String sql = "SELECT s.id AS staff_id, u.id AS user_id, s.staff_code, s.full_name, u.email, s.school_id, "
				+ "ack.acknowledged_at " + READERS + " AND d.id = :id"
				+ " AND (CAST(:ack AS boolean) IS NULL OR (ack.acknowledged_at IS NOT NULL) = CAST(:ack AS boolean))"
				+ " ORDER BY s.full_name";
		return jdbc.query(sql, new MapSqlParameterSource("id", documentId).addValue("ack", acknowledged),
				LibraryReaderQuery::map);
	}

	/** Số người cần đọc và đã đọc của từng văn bản (văn bản không có ai cần đọc thì không có trong kết quả). */
	public Map<UUID, Stats> stats(Collection<UUID> documentIds) {
		Map<UUID, Stats> result = new HashMap<>();
		if (documentIds.isEmpty()) {
			return result;
		}
		String sql = "SELECT d.id, count(*) AS required, count(ack.acknowledged_at) AS acknowledged " + READERS
				+ " AND d.id IN (:ids) GROUP BY d.id";
		jdbc.query(sql, new MapSqlParameterSource("ids", documentIds), rs -> {
			result.put(rs.getObject("id", UUID.class), new Stats(rs.getLong("required"), rs.getLong("acknowledged")));
		});
		return result;
	}

	/** Nhân viên thuộc diện cần đọc văn bản (điều kiện để xác nhận). */
	public boolean isReader(UUID documentId, UUID staffId) {
		String sql = "SELECT count(*) " + READERS + " AND d.id = :id AND s.id = :staffId";
		Long count = jdbc.queryForObject(sql, new MapSqlParameterSource("id", documentId).addValue("staffId", staffId),
				Long.class);
		return count != null && count > 0;
	}

	/** Văn bản yêu cầu xác nhận mà nhân viên thuộc diện cần đọc: chưa đọc trước, rồi mới ban hành trước. */
	public List<UUID> documentsToAcknowledge(UUID staffId, int limit) {
		String sql = "SELECT d.id " + READERS + " AND d.require_ack AND s.id = :staffId"
				+ " ORDER BY (ack.acknowledged_at IS NOT NULL), d.issued_date DESC NULLS LAST, d.created_at DESC LIMIT :limit";
		return jdbc.queryForList(sql, new MapSqlParameterSource("staffId", staffId).addValue("limit", limit), UUID.class);
	}

	private static Reader map(ResultSet rs, int row) throws SQLException {
		java.sql.Timestamp at = rs.getTimestamp("acknowledged_at");
		return new Reader(rs.getObject("staff_id", UUID.class), rs.getObject("user_id", UUID.class),
				rs.getString("staff_code"), rs.getString("full_name"), rs.getString("email"),
				rs.getObject("school_id", UUID.class), at == null ? null : at.toInstant());
	}

}
