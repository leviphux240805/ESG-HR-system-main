package com.preschool.account.controller;

import java.util.UUID;

import com.preschool.account.dto.AccountDtos.AccountItem;
import com.preschool.account.dto.AccountDtos.CreateAccountRequest;
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

/** Quản lý tài khoản đăng nhập (chủ chuỗi, văn phòng điều hành). */
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
	@Operation(summary = "Tạo tài khoản và gửi email mời đặt mật khẩu")
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

	@PostMapping("/{id}/send-reset")
	@ResponseStatus(HttpStatus.ACCEPTED)
	@Operation(summary = "Gửi email đặt lại mật khẩu")
	public void sendReset(@PathVariable UUID id) {
		accounts.sendReset(id);
	}

}
