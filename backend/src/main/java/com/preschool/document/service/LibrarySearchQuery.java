package com.preschool.document.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.preschool.common.error.ApiException;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tìm văn bản người dùng được xem, có phân trang. Native SQL (điều kiện vai trò trên mảng {@code visible_roles}) nên
 * KHÔNG qua Hibernate filter: phạm vi cơ sở truyền vào tường minh. Điều kiện xem phải khớp
 * {@link LibraryAccess#canView}.
 */
@Component
public class LibrarySearchQuery {

	/** Phạm vi và quyền của người đang xem. */
	public record Viewer(UUID userId, Set<UUID> schoolIds, boolean allSchools, boolean chainPublisher,
			Set<UUID> publisherSchools) {
	}

	public record Criteria(UUID folderId, boolean unfiled, String q) {
	}

	private static final Map<String, String> SORT_COLUMNS = Map.of("issuedDate", "d.issued_date", "title",
			"lower(d.title)", "createdAt", "d.created_at", "docNumber", "d.doc_number");

	private static final String FROM = """
			FROM library_documents d
			WHERE (:allSchools OR d.school_id IS NULL OR d.school_id IN (:schoolIds))
			  AND (CAST(:folderId AS uuid) IS NULL OR d.folder_id = CAST(:folderId AS uuid))
			  AND (NOT :unfiled OR d.folder_id IS NULL)
			  AND (CAST(:q AS varchar) IS NULL OR d.title ILIKE CAST(:q AS varchar) OR d.doc_number ILIKE CAST(:q AS varchar))
			  AND (:chainPublisher
			       OR d.school_id IN (:publisherSchools)
			       OR cardinality(d.visible_roles) = 0
			       OR EXISTS (SELECT 1 FROM user_roles ur
			                  WHERE ur.user_id = :userId AND ur.role_code = ANY (d.visible_roles)
			                    AND (ur.school_id IS NULL
			                         OR (d.school_id IS NULL AND ur.school_id IN (:schoolIds))
			                         OR ur.school_id = d.school_id)))
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public LibrarySearchQuery(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<UUID> find(Viewer viewer, Criteria criteria, Pageable pageable) {
		String sql = "SELECT d.id " + FROM + " ORDER BY " + orderBy(pageable.getSort())
				+ " LIMIT :limit OFFSET :offset";
		return jdbc.queryForList(sql, params(viewer, criteria).addValue("limit", pageable.getPageSize())
			.addValue("offset", pageable.getOffset()), UUID.class);
	}

	public long count(Viewer viewer, Criteria criteria) {
		Long total = jdbc.queryForObject("SELECT count(*) " + FROM, params(viewer, criteria), Long.class);
		return total == null ? 0 : total;
	}

	private static String orderBy(Sort sort) {
		if (sort.isUnsorted()) {
			return "d.issued_date DESC NULLS LAST, d.created_at DESC";
		}
		StringBuilder sql = new StringBuilder();
		for (Sort.Order order : sort) {
			String column = SORT_COLUMNS.get(order.getProperty());
			if (column == null) {
				throw ApiException.badRequest("SORT_INVALID", "Không sắp xếp được theo cột này.");
			}
			sql.append(column).append(order.isAscending() ? " ASC NULLS LAST, " : " DESC NULLS LAST, ");
		}
		return sql.append("d.id").toString();
	}

	private static MapSqlParameterSource params(Viewer viewer, Criteria criteria) {
		// IN () rỗng không hợp lệ: dùng UUID không thuộc cơ sở nào
		List<UUID> none = List.of(new UUID(0, 0));
		String q = criteria.q() == null || criteria.q().isBlank() ? null
				: "%" + criteria.q().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
		return new MapSqlParameterSource().addValue("userId", viewer.userId())
			.addValue("allSchools", viewer.allSchools())
			.addValue("schoolIds", viewer.schoolIds().isEmpty() ? none : viewer.schoolIds())
			.addValue("chainPublisher", viewer.chainPublisher())
			.addValue("publisherSchools", viewer.publisherSchools().isEmpty() ? none : viewer.publisherSchools())
			.addValue("folderId", criteria.folderId())
			.addValue("unfiled", criteria.unfiled())
			.addValue("q", q);
	}

}
