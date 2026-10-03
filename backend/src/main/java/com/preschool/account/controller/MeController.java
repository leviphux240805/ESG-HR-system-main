package com.preschool.account.controller;

import com.preschool.account.dto.MeResponse;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.error.ApiException;
import com.preschool.school.entity.Organization;
import com.preschool.school.repository.OrganizationRepository;
import com.preschool.security.SchoolAccess;
import com.preschool.security.SchoolAccessService;
import com.preschool.security.SchoolScope;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Xác thực")
public class MeController {

	private final UserRepository users;

	private final SchoolAccessService accessService;

	private final OrganizationRepository organizations;

	public MeController(UserRepository users, SchoolAccessService accessService,
			OrganizationRepository organizations) {
		this.users = users;
		this.accessService = accessService;
		this.organizations = organizations;
	}

	@GetMapping
	@Transactional(readOnly = true)
	@Operation(summary = "Thông tin người dùng hiện tại, tổ chức, vai trò và các trường được phép")
	public MeResponse me() {
		SchoolAccess access = SchoolScope.require().access();
		User user = users.findById(access.userId())
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
		Organization organization = organizations.findById(access.organizationId()).orElseThrow();
		return new MeResponse(user.getId(), user.getEmail(), user.getPhone(), user.getFullName(),
				user.isMustChangePassword(), user.getStaffId(),
				new MeResponse.OrganizationSummary(organization.getId(), organization.getName()),
				access.grants()
					.stream()
					.filter(g -> access.canAccess(g.schoolId()))
					.map(g -> new MeResponse.RoleGrant(g.role(), g.schoolId(), g.groups()))
					.toList(),
				accessService.allowedSchools(access)
					.stream()
					.map(s -> new MeResponse.SchoolSummary(s.getId(), s.getCode(), s.getName(), s.getType(),
							s.getParentId()))
					.toList());
	}

}
