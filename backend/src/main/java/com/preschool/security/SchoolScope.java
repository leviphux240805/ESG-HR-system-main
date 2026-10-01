package com.preschool.security;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;

/**
 * Phạm vi trường của request hiện tại: người dùng, trường đang chọn (header {@code X-School-Id}) và tập trường được
 * lọc. Do {@link SchoolScopeFilter} tạo sau khi xác thực JWT; đọc qua {@link #current()}.
 *
 * @param access phạm vi đầy đủ của người dùng
 * @param selectedSchoolId trường đang chọn; rỗng = "Tất cả trường" được gán
 */
public record SchoolScope(SchoolAccess access, UUID selectedSchoolId) {

	/** Header chứa cơ sở đang chọn trên giao diện. */
	public static final String HEADER = "X-School-Id";

	/** Đường dẫn không phụ thuộc cơ sở đang chọn: bỏ qua header để app luôn khởi động được. */
	public static final List<String> SCHOOL_AGNOSTIC_PREFIXES = List.of("/api/v1/auth/", "/api/v1/me/");

	public static boolean isSchoolAgnostic(String path) {
		return path.equals("/api/v1/me") || SCHOOL_AGNOSTIC_PREFIXES.stream().anyMatch(path::startsWith);
	}

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

	public UUID organizationId() {
		return access.organizationId();
	}

	/** Các trường mà truy vấn được phép thấy trong request này ("Tất cả trường" = mọi trường được gán). */
	public Set<UUID> effectiveSchoolIds() {
		return selectedSchoolId != null ? Set.of(selectedSchoolId) : access.schoolIds();
	}

	/** Có vai trò {@code role} ở ít nhất một trường trong phạm vi đang chọn. */
	public boolean hasRole(RoleCode role) {
		return effectiveSchoolIds().stream().anyMatch(id -> access.hasRole(role, id));
	}

	/** Có vai trò {@code role} ở trường {@code schoolId} (và trường đó nằm trong phạm vi đang chọn). */
	public boolean hasRoleAt(RoleCode role, UUID schoolId) {
		return canAccessSchool(schoolId) && access.hasRole(role, schoolId);
	}

	public boolean canAccessSchool(UUID schoolId) {
		return schoolId != null && effectiveSchoolIds().contains(schoolId);
	}

	/** Hiệu trưởng, hoặc phó hiệu trưởng được giao {@code group}, ở trường {@code schoolId} trong phạm vi. */
	public boolean manages(UUID schoolId, FunctionGroup group) {
		return canAccessSchool(schoolId) && access.manages(schoolId, group);
	}

	/** Quản lý nhóm {@code group} ở ít nhất một trường trong phạm vi đang chọn. */
	public boolean managesAny(FunctionGroup group) {
		return effectiveSchoolIds().stream().anyMatch(id -> access.manages(id, group));
	}

	/** Hiệu trưởng (ở bất kỳ trường nào của mình): sửa dữ liệu dùng chung của tổ chức. */
	public boolean isPrincipal() {
		return access.hasRoleAnywhere(RoleCode.PRINCIPAL);
	}

}
