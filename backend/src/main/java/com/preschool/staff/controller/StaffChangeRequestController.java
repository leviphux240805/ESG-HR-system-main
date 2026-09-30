package com.preschool.staff.controller;

import java.util.UUID;

import com.preschool.common.web.PageResponse;
import com.preschool.staff.dto.ChangeRequestDtos.ChangeRequestDto;
import com.preschool.staff.dto.ChangeRequestDtos.RejectRequest;
import com.preschool.staff.dto.ChangeRequestDtos.ReviewRequest;
import com.preschool.staff.entity.StaffEnums.ChangeRequestStatus;
import com.preschool.staff.service.StaffChangeRequestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Duyệt đề xuất cập nhật hồ sơ của nhân viên. */
@RestController
@RequestMapping("/api/v1/staff/change-requests")
@Tag(name = "Nhân sự")
public class StaffChangeRequestController {

	private final StaffChangeRequestService changeRequests;

	public StaffChangeRequestController(StaffChangeRequestService changeRequests) {
		this.changeRequests = changeRequests;
	}

	@GetMapping
	@Operation(summary = "Đề xuất người xem được duyệt (theo cơ sở đang chọn); status rỗng = mọi trạng thái")
	public PageResponse<ChangeRequestDto> list(@RequestParam(required = false) ChangeRequestStatus status,
			@ParameterObject Pageable pageable) {
		return changeRequests.list(status, pageable);
	}

	@PostMapping("/{id}/approve")
	@Operation(summary = "Duyệt: ghi thay đổi vào hồ sơ")
	public ChangeRequestDto approve(@PathVariable UUID id, @Valid @RequestBody(required = false) ReviewRequest request) {
		return changeRequests.approve(id, request == null ? null : request.note());
	}

	@PostMapping("/{id}/reject")
	@Operation(summary = "Từ chối (cần lý do)")
	public ChangeRequestDto reject(@PathVariable UUID id, @Valid @RequestBody RejectRequest request) {
		return changeRequests.reject(id, request.note());
	}

}
