package com.preschool.account.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.dto.AccountDtos.AccountItem;
import com.preschool.account.dto.AccountDtos.AccountRole;
import com.preschool.account.dto.AccountDtos.AccountRoleView;
import com.preschool.account.dto.AccountDtos.CreateAccountRequest;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.entity.UserRole;
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
 * Quản lý tài khoản đăng nhập: chỉ chủ chuỗi và văn phòng điều hành (vai trò toàn chuỗi). Chặn tự khóa mình, khóa
 * hoặc gỡ vai trò của chủ chuỗi cuối cùng; chỉ chủ chuỗi được gán/gỡ vai trò chủ chuỗi và khóa tài khoản chủ chuỗi.
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
		requireManager();
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
			if (role != null || schoolId != null) {
				var roles = root.join("roles", JoinType.INNER);
				if (role != null) {
					predicates.add(cb.equal(roles.get("roleCode"), role));
				}
				if (schoolId != null) {
					predicates.add(cb.equal(roles.get("schoolId"), schoolId));
				}
				query.distinct(true);
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
		Page<User> page = users.findAll(spec, sanitize(pageable));
		return PageResponse.of(page.map(this::toItem));
	}

	@Transactional
	public AccountItem create(CreateAccountRequest request) {
		requireManager();
		List<AccountService.Grant> grants = toGrants(request.roles());
		requireOwnerForOwnerRole(grants, List.of());
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
		return toItem(user);
	}

	@Transactional
	public AccountItem updateRoles(UUID id, List<AccountRole> roles) {
		requireManager();
		User user = find(id);
		List<AccountService.Grant> grants = toGrants(roles);
		requireOwnerForOwnerRole(grants, user.getRoles());
		boolean losesOwner = hasOwner(user.getRoles()) && grants.stream().noneMatch(g -> g.role() == RoleCode.OWNER);
		if (losesOwner && user.isActive() && activeOwnerCount() <= 1) {
			throw ApiException.conflict("LAST_OWNER", "Không gỡ được vai trò của chủ chuỗi cuối cùng.");
		}
		Map<String, Object> before = snapshot(user);
		user.replaceRoles(grants.stream()
			.map(g -> Map.entry(g.role(), g.schoolId() == null ? User.NO_SCHOOL : g.schoolId()))
			.toList());
		users.saveAndFlush(user);
		audit.record("account", id, Action.UPDATE, before, snapshot(user));
		return toItem(user);
	}

	@Transactional
	public AccountItem lock(UUID id) {
		requireManager();
		User user = find(id);
		if (user.getId().equals(SchoolScope.require().userId())) {
			throw ApiException.conflict("SELF_LOCK", "Không tự khóa tài khoản của chính mình.");
		}
		if (hasOwner(user.getRoles())) {
			requireOwner("Chỉ chủ chuỗi được khóa tài khoản chủ chuỗi.");
			if (user.isActive() && activeOwnerCount() <= 1) {
				throw ApiException.conflict("LAST_OWNER", "Không khóa được chủ chuỗi cuối cùng.");
			}
		}
		if (user.isActive()) {
			user.setActive(false);
			refreshTokens.revokeAllForUser(user.getId(), clock.instant());
			audit.record("account", id, Action.UPDATE, Map.of("active", true), Map.of("active", false));
		}
		return toItem(user);
	}

	@Transactional
	public AccountItem unlock(UUID id) {
		requireManager();
		User user = find(id);
		if (!user.isActive()) {
			user.setActive(true);
			audit.record("account", id, Action.UPDATE, Map.of("active", false), Map.of("active", true));
		}
		return toItem(user);
	}

	/** Gửi email đặt lại mật khẩu (như "Quên mật khẩu"); tài khoản bị khóa thì không gửi. */
	@Transactional
	public void sendReset(UUID id) {
		requireManager();
		User user = find(id);
		if (!user.isActive()) {
			throw ApiException.conflict("ACCOUNT_LOCKED", "Tài khoản đang bị khóa, mở khóa trước khi gửi email đặt lại mật khẩu.");
		}
		passwordResetService.requestReset(user.getEmail());
	}

	// ------------------------------------------------------------ hỗ trợ

	private static void requireManager() {
		boolean chainManager = SchoolScope.require().access().grants().stream()
			.anyMatch(g -> g.schoolId() == null && (g.role() == RoleCode.OWNER || g.role() == RoleCode.CHAIN_ADMIN));
		if (!chainManager) {
			throw ApiException.forbidden("ACCOUNT_FORBIDDEN",
					"Chỉ chủ chuỗi hoặc văn phòng điều hành được quản lý tài khoản.");
		}
	}

	private static void requireOwner(String message) {
		if (!SchoolScope.require().access().hasRoleAnywhere(RoleCode.OWNER)) {
			throw ApiException.forbidden("OWNER_REQUIRED", message);
		}
	}

	/** TODO(assumption): chỉ chủ chuỗi gán hoặc gỡ vai trò chủ chuỗi (tránh văn phòng điều hành tự nâng quyền). */
	private static void requireOwnerForOwnerRole(List<AccountService.Grant> wanted, List<UserRole> current) {
		boolean wantsOwner = wanted.stream().anyMatch(g -> g.role() == RoleCode.OWNER);
		if (wantsOwner != hasOwner(current)) {
			requireOwner("Chỉ chủ chuỗi được gán hoặc gỡ vai trò chủ chuỗi.");
		}
	}

	private static boolean hasOwner(List<UserRole> roles) {
		return roles.stream().anyMatch(r -> r.getRoleCode() == RoleCode.OWNER);
	}

	private long activeOwnerCount() {
		return users.findActiveByRole(RoleCode.OWNER, null).size();
	}

	private List<AccountService.Grant> toGrants(List<AccountRole> roles) {
		List<AccountService.Grant> grants = roles.stream().map(r -> new AccountService.Grant(r.role(), r.schoolId()))
			.distinct().toList();
		accountService.validateGrants(grants);
		return grants;
	}

	private User find(UUID id) {
		return users.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
	}

	private AccountItem toItem(User user) {
		Map<UUID, String> schoolNames = schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
		Map<String, Object> staff = user.getStaffId() == null ? null : staffRow(user.getStaffId());
		List<AccountRoleView> roles = user.getRoles().stream()
			.map(r -> new AccountRoleView(r.getRoleCode(), r.getSchoolId(), schoolNames.get(r.getSchoolId())))
			.sorted(java.util.Comparator.comparing(AccountRoleView::role))
			.toList();
		return new AccountItem(user.getId(), user.getEmail(), user.getPhone(), user.getFullName(), user.isActive(),
				user.getLastLoginAt(), roles, user.getStaffId(), staff == null ? null : (String) staff.get("staff_code"),
				staff == null ? null : (String) staff.get("full_name"),
				user.getId().equals(SchoolScope.require().userId()));
	}

	/** Mã và tên nhân viên, không qua filter cơ sở (tài khoản là dữ liệu toàn chuỗi). */
	private Map<String, Object> staffRow(UUID staffId) {
		List<Map<String, Object>> rows = jdbc.queryForList(
				"SELECT staff_code, full_name FROM staff WHERE id = :id AND deleted_at IS NULL",
				new MapSqlParameterSource("id", staffId));
		return rows.isEmpty() ? null : rows.getFirst();
	}

	private static Map<String, Object> snapshot(User user) {
		return Map.of("email", user.getEmail(), "active", user.isActive(), "roles", user.getRoles().stream()
			.map(r -> r.getRoleCode() + (r.getSchoolId() == null ? "" : "@" + r.getSchoolId()))
			.sorted().toList(), "staffId", Objects.toString(user.getStaffId(), ""));
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
