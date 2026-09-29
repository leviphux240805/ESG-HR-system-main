package com.preschool.security;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;

/**
 * Phạm vi cơ sở của request hiện tại: người dùng, cơ sở đang chọn (header {@code X-School-Id}) và tập cơ sở được
 * lọc. Do {@link SchoolScopeFilter} tạo sau khi xác thực JWT; đọc qua {@link #current()}.
 *
 * @param access phạm vi đầy đủ của người dùng
 * @param selectedSchoolId cơ sở đang chọn; rỗng = "Tất cả cơ sở" trong phạm vi
 */
public record SchoolScope(SchoolAccess access, UUID selectedSchoolId) {

	/** Header chứa cơ sở đang chọn trên giao diện. */
	public static final String HEADER = "X-School-Id";

	/** Đường dẫn không phụ thuộc cơ sở đang chọn: bỏ qua header để app luôn khởi động được. */
	public static final List<String> SCHOOL_AGNOSTIC_PREFIXES = List.of("/api/v1/auth/", "/api/v1/me");

	private static final ThreadLocal<SchoolScope> CURRENT = new ThreadLocal<>();

	public static Optional<SchoolScope> current() {
		return Optional.ofNullable(CURRENT.get());
	}

	public static SchoolScope require() {
		return current().orElseThrow(() -> new IllegalStateException("Không có SchoolScope trong request này"));
	}

	static void set(SchoolScope scope) {
		CURRENT.set(scope);
	}

	static void clear() {
		CURRENT.remove();
	}

	public UUID userId() {
		return access.userId();
	}

	/** Các cơ sở mà truy vấn được phép thấy trong request này. */
	public Set<UUID> effectiveSchoolIds() {
		return selectedSchoolId != null ? Set.of(selectedSchoolId) : access.schoolIds();
	}

	/**
	 * Tập school_id dùng cho Hibernate filter. Rỗng = không giới hạn: chỉ khi người dùng có vai trò cấp chuỗi và
	 * chọn "Tất cả cơ sở" (khi đó thấy cả dữ liệu của cơ sở đã ngừng hoạt động).
	 */
	public Optional<Set<UUID>> filterSchoolIds() {
		if (selectedSchoolId == null && access.chainWide()) {
			return Optional.empty();
		}
		return Optional.of(effectiveSchoolIds());
	}

	/** Có vai trò {@code role} áp dụng cho ít nhất một cơ sở trong phạm vi đang chọn. */
	public boolean hasRole(RoleCode role) {
		return access.grants()
			.stream()
			.anyMatch(g -> g.role() == role && (g.schoolId() == null || effectiveSchoolIds().contains(g.schoolId())));
	}

	/** Có vai trò {@code role} áp dụng cho cơ sở {@code schoolId} (và cơ sở đó nằm trong phạm vi đang chọn). */
	public boolean hasRoleAt(RoleCode role, UUID schoolId) {
		return schoolId != null && effectiveSchoolIds().contains(schoolId) && access.hasRole(role, schoolId);
	}

	public boolean canAccessSchool(UUID schoolId) {
		return schoolId != null && effectiveSchoolIds().contains(schoolId);
	}

}
