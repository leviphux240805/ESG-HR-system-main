package com.preschool.security;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.error.ApiException;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SchoolAccessService {

	private final UserRepository users;

	private final SchoolRepository schools;

	public SchoolAccessService(UserRepository users, SchoolRepository schools) {
		this.users = users;
		this.schools = schools;
	}

	/** Nạp phạm vi của người dùng; tài khoản không tồn tại hoặc đã khóa thì từ chối. */
	@Transactional(readOnly = true)
	public SchoolAccess load(UUID userId) {
		User user = users.findWithRolesById(userId)
			.filter(User::isActive)
			.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED",
					"Tài khoản không còn hoạt động. Vui lòng đăng nhập lại."));

		List<SchoolAccess.Grant> grants = user.getRoles()
			.stream()
			.map(r -> new SchoolAccess.Grant(r.getRoleCode(), r.getSchoolId()))
			.toList();
		boolean chainWide = grants.stream().anyMatch(g -> g.schoolId() == null);

		Set<UUID> activeIds = new LinkedHashSet<>();
		schools.findAllByActiveTrueOrderByCode().forEach(s -> activeIds.add(s.getId()));
		Set<UUID> allowed = new LinkedHashSet<>();
		if (chainWide) {
			allowed.addAll(activeIds);
		}
		else {
			grants.stream().map(SchoolAccess.Grant::schoolId).filter(activeIds::contains).forEach(allowed::add);
		}
		return new SchoolAccess(userId, grants, chainWide, Set.copyOf(allowed));
	}

	@Transactional(readOnly = true)
	public List<School> allowedSchools(SchoolAccess access) {
		return schools.findAllByActiveTrueOrderByCode().stream().filter(s -> access.canAccess(s.getId())).toList();
	}

}
