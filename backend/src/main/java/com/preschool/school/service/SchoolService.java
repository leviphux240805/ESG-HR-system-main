package com.preschool.school.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.school.dto.SchoolDtos.SchoolDto;
import com.preschool.school.dto.SchoolDtos.SchoolRequest;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolAccess;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trường của tổ chức: hiệu trưởng tạo trường (tự gán vai trò hiệu trưởng cho người tạo), sửa và ngừng/mở lại trường
 * mình làm hiệu trưởng. Danh sách gồm mọi trường người dùng có vai trò (kể cả trường đã ngừng mà mình là hiệu
 * trưởng); không thấy trường của hiệu trưởng khác.
 */
@Service
@Transactional
public class SchoolService {

	private final SchoolRepository schools;

	private final UserRepository users;

	private final AuditService audit;

	public SchoolService(SchoolRepository schools, UserRepository users, AuditService audit) {
		this.schools = schools;
		this.users = users;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public List<SchoolDto> list() {
		SchoolAccess access = scope().access();
		Set<UUID> ids = access.grants().stream().map(SchoolAccess.Grant::schoolId).collect(Collectors.toSet());
		return schools.findAllByIdInOrderByCode(ids)
			.stream()
			.filter(s -> s.isActive() || access.hasRole(RoleCode.PRINCIPAL, s.getId()))
			.sorted(Comparator.comparing(School::isActive).reversed().thenComparing(School::getCode))
			.map(s -> toDto(s, access))
			.toList();
	}

	public SchoolDto create(SchoolRequest r) {
		SchoolScope scope = scope();
		if (!scope.isPrincipal()) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Chỉ hiệu trưởng được tạo trường mới.");
		}
		requireUniqueCode(scope.organizationId(), r.code().trim(), null);
		School school = new School(r.code().trim(), r.name().trim());
		apply(school, r);
		schools.saveAndFlush(school);
		User me = users.findById(scope.userId()).orElseThrow();
		me.addRole(RoleCode.PRINCIPAL, school.getId());
		users.save(me);
		audit.record("schools", school.getId(), Action.CREATE, null, snapshot(school));
		return new SchoolDto(school.getId(), school.getCode(), school.getName(), school.getType(), school.getParentId(),
				school.getProvinceCode(), school.getWardCode(), school.getAddressDetail(), school.getPhone(),
				school.getLicenseNo(), true, true);
	}

	public SchoolDto update(UUID id, SchoolRequest r) {
		School school = editable(id);
		requireUniqueCode(school.getOrganizationId(), r.code().trim(), id);
		Map<String, Object> before = snapshot(school);
		apply(school, r);
		audit.record("schools", id, Action.UPDATE, before, snapshot(school));
		return toDto(school, scope().access());
	}

	/** Ngừng hoạt động: dữ liệu giữ nguyên nhưng không ai chọn được trường; không ngừng trường cuối cùng của mình. */
	public SchoolDto setActive(UUID id, boolean active) {
		School school = editable(id);
		SchoolAccess access = scope().access();
		if (!active && school.isActive() && access.schoolIds().equals(Set.of(id))) {
			throw ApiException.conflict("LAST_SCHOOL", "Không ngừng được trường cuối cùng bạn đang quản lý.");
		}
		if (school.isActive() != active) {
			school.setActive(active);
			audit.record("schools", id, Action.UPDATE, Map.of("active", !active), Map.of("active", active));
		}
		return toDto(school, access);
	}

	private School editable(UUID id) {
		SchoolAccess access = scope().access();
		School school = schools.findById(id)
			.filter(s -> access.grants().stream().anyMatch(g -> g.schoolId().equals(s.getId())))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
		if (!access.hasRole(RoleCode.PRINCIPAL, id)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Chỉ hiệu trưởng của trường được sửa trường này.");
		}
		return school;
	}

	private void requireUniqueCode(UUID organizationId, String code, UUID exceptId) {
		boolean taken = exceptId == null ? schools.existsByOrganizationIdAndCodeIgnoreCase(organizationId, code)
				: schools.existsByOrganizationIdAndCodeIgnoreCaseAndIdNot(organizationId, code, exceptId);
		if (taken) {
			throw ApiException.conflict("SCHOOL_CODE_EXISTS", "Mã trường đã được dùng.")
				.withFieldErrors(List.of(Map.of("field", "code", "message", "Mã trường đã được dùng.")));
		}
	}

	private static void apply(School school, SchoolRequest r) {
		school.update(r.code().trim(), r.name().trim(), blankToNull(r.provinceCode()), blankToNull(r.wardCode()),
				blankToNull(r.addressDetail()), blankToNull(r.phone()), blankToNull(r.licenseNo()));
	}

	private static SchoolDto toDto(School s, SchoolAccess access) {
		return new SchoolDto(s.getId(), s.getCode(), s.getName(), s.getType(), s.getParentId(), s.getProvinceCode(),
				s.getWardCode(), s.getAddressDetail(), s.getPhone(), s.getLicenseNo(), s.isActive(),
				access.hasRole(RoleCode.PRINCIPAL, s.getId()));
	}

	private static Map<String, Object> snapshot(School s) {
		return Map.of("code", s.getCode(), "name", s.getName(), "active", s.isActive());
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

}
