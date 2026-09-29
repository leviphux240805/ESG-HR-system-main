package com.preschool.account.controller;

import com.preschool.account.dto.MeResponse;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.error.ApiException;
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

	public MeController(UserRepository users, SchoolAccessService accessService) {
		this.users = users;
		this.accessService = accessService;
	}

	@GetMapping
	@Transactional(readOnly = true)
	@Operation(summary = "Thông tin người dùng hiện tại, vai trò và các cơ sở được phép")
	public MeResponse me() {
		SchoolAccess access = SchoolScope.require().access();
		User user = users.findById(access.userId())
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
		return new MeResponse(user.getId(), user.getEmail(), user.getPhone(), user.getFullName(),
				access.grants().stream().map(g -> new MeResponse.RoleGrant(g.role(), g.schoolId())).toList(),
				access.chainWide(),
				accessService.allowedSchools(access)
					.stream()
					.map(s -> new MeResponse.SchoolSummary(s.getId(), s.getCode(), s.getName()))
					.toList());
	}

}
