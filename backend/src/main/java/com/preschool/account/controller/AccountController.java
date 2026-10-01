package com.preschool.account.controller;

import java.util.UUID;

import com.preschool.account.dto.AccountDtos.AccountItem;
import com.preschool.account.dto.AccountDtos.CreateAccountRequest;
import com.preschool.account.dto.AccountDtos.SetPasswordRequest;
import com.preschool.account.dto.AccountDtos.UpdateRolesRequest;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.service.AccountAdminService;
import com.preschool.common.web.PageResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Quản lý tài khoản đăng nhập (hiệu trưởng). */
@RestController
@RequestMapping("/api/v1/accounts")
@Tag(name = "Tài khoản")
public class AccountController {

	private final AccountAdminService accounts;

	public AccountController(AccountAdminService accounts) {
		this.accounts = accounts;
	}

	@GetMapping
	@Operation(summary = "Danh sách tài khoản", description = "Sắp xếp: fullName, email, lastLoginAt.")
	public PageResponse<AccountItem> list(
			@Parameter(description = "Tìm theo tên, email, SĐT") @RequestParam(required = false) String q,
			@RequestParam(required = false) RoleCode role, @RequestParam(required = false) UUID schoolId,
			@RequestParam(required = false) Boolean active, @ParameterObject Pageable pageable) {
		return accounts.list(q, role, schoolId, active, pageable);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Tạo tài khoản với mật khẩu ban đầu (người dùng đổi ở lần đăng nhập đầu)")
	public AccountItem create(@Valid @RequestBody CreateAccountRequest request) {
		return accounts.create(request);
	}

	@PutMapping("/{id}/roles")
	@Operation(summary = "Gán lại vai trò theo cơ sở")
	public AccountItem updateRoles(@PathVariable UUID id, @Valid @RequestBody UpdateRolesRequest request) {
		return accounts.updateRoles(id, request.roles());
	}

	@PostMapping("/{id}/lock")
	@Operation(summary = "Khóa tài khoản (thu hồi mọi phiên đăng nhập)")
	public AccountItem lock(@PathVariable UUID id) {
		return accounts.lock(id);
	}

	@PostMapping("/{id}/unlock")
	public AccountItem unlock(@PathVariable UUID id) {
		return accounts.unlock(id);
	}

	@PostMapping("/{id}/password")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Đặt mật khẩu mới (người dùng đổi ở lần đăng nhập kế tiếp; đăng xuất mọi phiên)")
	public void setPassword(@PathVariable UUID id, @Valid @RequestBody SetPasswordRequest request) {
		accounts.setPassword(id, request.password());
	}

}
