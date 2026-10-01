package com.preschool.account.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.preschool.account.dto.AccountDtos.AccountItem;
import com.preschool.account.dto.AccountDtos.AccountRole;
import com.preschool.account.dto.AccountDtos.AccountRoleView;
import com.preschool.account.dto.AccountDtos.CreateAccountRequest;
import com.preschool.account.entity.RoleAssignment;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.RefreshTokenRepository;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.web.PageResponse;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;

import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản lý tài khoản đăng nhập: hiệu trưởng, trong các trường mình làm hiệu trưởng. Thấy tài khoản có vai trò ở các
 * trường đó; gán, gỡ vai trò (trừ hiệu trưởng) chỉ ở các trường đó, vai trò ở trường khác giữ nguyên. Tài khoản hiệu
 * trưởng do bên vận hành quản lý: không sửa vai trò, không khóa. Chặn tự khóa mình.
 */
@Service
public class AccountAdminService {

	private static final Map<String, String> SORTABLE = Map.of("fullName", "fullName", "email", "email",
			"lastLoginAt", "lastLoginAt");

	private final UserRepository users;

	private final AccountService accountService;

	private final PasswordResetService passwordResetService;

	private final RefreshTokenRepository refreshTokens;

	private final SchoolRepository schools;

	private final NamedParameterJdbcTemplate jdbc;

	private final AuditService audit;

	private final Clock clock;

	public AccountAdminService(UserRepository users, AccountService accountService,
			PasswordResetService passwordResetService, RefreshTokenRepository refreshTokens, SchoolRepository schools,
			NamedParameterJdbcTemplate jdbc, AuditService audit, Clock clock) {
		this.users = users;
		this.accountService = accountService;
		this.passwordResetService = passwordResetService;
		this.refreshTokens = refreshTokens;
		this.schools = schools;
		this.jdbc = jdbc;
		this.audit = audit;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public PageResponse<AccountItem> list(String q, RoleCode role, UUID schoolId, Boolean active, Pageable pageable) {
		Set<UUID> managed = managedSchools();
		Specification<User> spec = (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (q != null && !q.isBlank()) {
				String like = "%" + q.trim().toLowerCase(java.util.Locale.ROOT) + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("fullName")), like), cb.like(root.get("email"), like),
						cb.like(cb.coalesce(root.get("phone"), ""), like)));
			}
			if (active != null) {
				predicates.add(cb.equal(root.get("active"), active));
			}
			var roles = root.join("roles", JoinType.INNER);
			predicates.add(roles.get("schoolId").in(schoolId != null ? Set.of(schoolId) : managed));
			if (role != null) {
				predicates.add(cb.equal(roles.get("roleCode"), role));
			}
			query.distinct(true);
			return cb.and(predicates.toArray(Predicate[]::new));
		};
		Page<User> page = users.findAll(spec, sanitize(pageable));
		Map<UUID, String> names = schoolNames();
		return PageResponse.of(page.map(u -> toItem(u, managed, names)));
	}

	@Transactional
	public AccountItem create(CreateAccountRequest request) {
		Set<UUID> managed = managedSchools();
		List<RoleAssignment> grants = toGrants(request.roles());
		String fullName = request.fullName();
		if (request.staffId() != null) {
			Map<String, Object> staff = staffRow(request.staffId());
			if (staff == null) {
				throw fieldError("staffId", "Không tìm thấy hồ sơ nhân viên");
			}
			if (users.findByStaffId(request.staffId()).isPresent()) {
				throw ApiException.conflict("STAFF_ALREADY_LINKED", "Hồ sơ nhân viên đã có tài khoản đăng nhập.")
					.withFieldErrors(List.of(Map.of("field", "staffId", "message", "hồ sơ này đã có tài khoản")));
			}
			if (fullName == null || fullName.isBlank()) {
				fullName = (String) staff.get("full_name");
			}
		}
		if (fullName == null || fullName.isBlank()) {
			throw fieldError("fullName", "Vui lòng nhập họ tên");
		}
		User user = accountService.create(request.email().trim().toLowerCase(java.util.Locale.ROOT),
				normalizePhone(request.phone()), fullName.trim(), request.staffId(), grants);
		audit.record("account", user.getId(), Action.CREATE, null, snapshot(user));
		return toItem(user, managed, schoolNames());
	}

	/** Thay vai trò ở các trường người gán quản lý; vai trò ở trường khác giữ nguyên. */
	@Transactional
	public AccountItem updateRoles(UUID id, List<AccountRole> roles) {
		Set<UUID> managed = managedSchools();
		User user = findManaged(id, managed);
		requireNotPrincipal(user, "Vai trò của tài khoản hiệu trưởng do bên vận hành quản lý.");
		List<RoleAssignment> wanted = toGrants(roles);
		Map<String, Object> before = snapshot(user);
		user.replaceRoles(Stream.concat(
				user.getRoles().stream().filter(r -> !managed.contains(r.getSchoolId())).map(r -> r.toAssignment()),
				wanted.stream())
			.toList());
		users.saveAndFlush(user);
		audit.record("account", id, Action.UPDATE, before, snapshot(user));
		return toItem(user, managed, schoolNames());
	}

	@Transactional
	public AccountItem lock(UUID id) {
		Set<UUID> managed = managedSchools();
		User user = findManaged(id, managed);
		if (user.getId().equals(SchoolScope.require().userId())) {
			throw ApiException.conflict("SELF_LOCK", "Không tự khóa tài khoản của chính mình.");
		}
		requireNotPrincipal(user, "Tài khoản hiệu trưởng do bên vận hành quản lý.");
		if (user.isActive()) {
			user.setActive(false);
			refreshTokens.revokeAllForUser(user.getId(), clock.instant());
			audit.record("account", id, Action.UPDATE, Map.of("active", true), Map.of("active", false));
		}
		return toItem(user, managed, schoolNames());
	}

	@Transactional
	public AccountItem unlock(UUID id) {
		Set<UUID> managed = managedSchools();
		User user = findManaged(id, managed);
		if (!user.isActive()) {
			user.setActive(true);
			audit.record("account", id, Action.UPDATE, Map.of("active", false), Map.of("active", true));
		}
		return toItem(user, managed, schoolNames());
	}

	/** Gửi email đặt lại mật khẩu (như "Quên mật khẩu"); tài khoản bị khóa thì không gửi. */
	@Transactional
	public void sendReset(UUID id) {
		User user = findManaged(id, managedSchools());
		if (!user.isActive()) {
			throw ApiException.conflict("ACCOUNT_LOCKED", "Tài khoản đang bị khóa, mở khóa trước khi gửi email đặt lại mật khẩu.");
		}
		passwordResetService.requestReset(user.getEmail());
	}

	// ------------------------------------------------------------ hỗ trợ

	/** Các trường (trong phạm vi đang chọn) người dùng làm hiệu trưởng; rỗng thì không có quyền quản lý tài khoản. */
	private static Set<UUID> managedSchools() {
		SchoolScope scope = SchoolScope.require();
		Set<UUID> managed = scope.effectiveSchoolIds()
			.stream()
			.filter(id -> AccountService.isPrincipalAt(scope, id))
			.collect(Collectors.toSet());
		if (managed.isEmpty()) {
			throw ApiException.forbidden("ACCOUNT_FORBIDDEN", "Chỉ hiệu trưởng được quản lý tài khoản.");
		}
		return managed;
	}

	private User findManaged(UUID id, Set<UUID> managed) {
		return users.findById(id)
			.filter(u -> u.getRoles().stream().anyMatch(r -> managed.contains(r.getSchoolId())))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
	}

	private static void requireNotPrincipal(User user, String message) {
		if (isPrincipal(user)) {
			throw ApiException.forbidden("PRINCIPAL_ACCOUNT", message);
		}
	}

	private static boolean isPrincipal(User user) {
		return user.getRoles().stream().anyMatch(r -> r.getRoleCode() == RoleCode.PRINCIPAL);
	}

	private List<RoleAssignment> toGrants(List<AccountRole> roles) {
		List<RoleAssignment> grants = roles.stream()
			.map(r -> new RoleAssignment(r.role(), r.schoolId(), r.functionGroups()))
			.distinct()
			.toList();
		accountService.validateGrants(grants);
		return grants;
	}

	private Map<UUID, String> schoolNames() {
		return schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
	}

	private AccountItem toItem(User user, Set<UUID> managed, Map<UUID, String> schoolNames) {
		Map<String, Object> staff = user.getStaffId() == null ? null : staffRow(user.getStaffId());
		boolean principal = isPrincipal(user);
		List<AccountRoleView> roles = user.getRoles()
			.stream()
			.map(r -> new AccountRoleView(r.getRoleCode(), r.getSchoolId(), schoolNames.get(r.getSchoolId()),
					r.getFunctionGroups(), !principal && managed.contains(r.getSchoolId())))
			.sorted(Comparator.comparing(AccountRoleView::role).thenComparing(v -> Objects.toString(v.schoolName(), "")))
			.toList();
		return new AccountItem(user.getId(), user.getEmail(), user.getPhone(), user.getFullName(), user.isActive(),
				user.getLastLoginAt(), roles, user.getStaffId(), staff == null ? null : (String) staff.get("staff_code"),
				staff == null ? null : (String) staff.get("full_name"),
				user.getId().equals(SchoolScope.require().userId()), principal);
	}

	/** Mã và tên nhân viên, không qua filter trường (tài khoản có thể có vai trò ở nhiều trường). */
	private Map<String, Object> staffRow(UUID staffId) {
		List<Map<String, Object>> rows = jdbc.queryForList("""
				SELECT s.staff_code, s.full_name FROM staff s JOIN schools sc ON sc.id = s.school_id
				WHERE s.id = :id AND s.deleted_at IS NULL AND sc.organization_id = :org""",
				new MapSqlParameterSource("id", staffId).addValue("org", SchoolScope.require().organizationId()));
		return rows.isEmpty() ? null : rows.getFirst();
	}

	private static Map<String, Object> snapshot(User user) {
		return Map.of("email", user.getEmail(), "active", user.isActive(), "roles", user.getRoles()
			.stream()
			.map(r -> r.getRoleCode() + "@" + r.getSchoolId()
					+ (r.getFunctionGroups().isEmpty() ? "" : r.getFunctionGroups().toString()))
			.sorted()
			.toList(), "staffId", Objects.toString(user.getStaffId(), ""));
	}

	private static Pageable sanitize(Pageable pageable) {
		List<Sort.Order> orders = new ArrayList<>();
		for (Sort.Order order : pageable.getSort()) {
			String property = SORTABLE.get(order.getProperty());
			if (property == null) {
				throw ApiException.badRequest("SORT_INVALID", "Không sắp xếp được theo cột này.");
			}
			orders.add(new Sort.Order(order.getDirection(), property));
		}
		Sort sort = orders.isEmpty() ? Sort.by("fullName") : Sort.by(orders);
		return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
	}

	private static String normalizePhone(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String digits = value.replaceAll("\\D", "");
		return digits.startsWith("84") && digits.length() == 11 ? "0" + digits.substring(2) : digits;
	}

	private static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_FAILED", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

}
