package com.preschool.today.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.today.dto.TodayDtos.ApprovalItem;
import com.preschool.today.dto.TodayDtos.ApprovalType;
import com.preschool.today.dto.TodayDtos.DecisionRequest;
import com.preschool.today.dto.TodayDtos.SubstitutionRequest;
import com.preschool.today.dto.TodayDtos.TodaySummary;
import com.preschool.today.service.ApprovalService;
import com.preschool.today.service.TodayService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Điều hành trong ngày: Hôm nay, phân công dạy thay, Hộp duyệt (gộp các trường đang chọn). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Điều hành")
public class TodayController {

	private final TodayService today;

	private final ApprovalService approvals;

	public TodayController(TodayService today, ApprovalService approvals) {
		this.today = today;
		this.approvals = approvals;
	}

	@GetMapping("/today")
	@Operation(summary = "Tình hình hôm nay: lớp, trẻ vắng, nhân viên nghỉ, việc cần xử lý")
	public TodaySummary today() {
		return today.today();
	}

	@PostMapping("/substitutions")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Phân công người dạy thay giáo viên nghỉ ở một lớp")
	public void assignSubstitute(@Valid @RequestBody SubstitutionRequest request) {
		today.assignSubstitute(request);
	}

	@GetMapping("/approvals")
	@Operation(summary = "Hộp duyệt: đơn nghỉ và việc chờ người xem duyệt")
	public List<ApprovalItem> approvals() {
		return approvals.items();
	}

	@PostMapping("/approvals/{type}/{id}/approve")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Duyệt đơn nghỉ hoặc việc (việc chuyển sang Hoàn thành)")
	public void approve(@PathVariable ApprovalType type, @PathVariable UUID id,
			@Valid @RequestBody(required = false) DecisionRequest request) {
		approvals.approve(type, id, request == null ? null : request.note());
	}

	@PostMapping("/approvals/{type}/{id}/reject")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Từ chối đơn nghỉ hoặc trả việc về Đang làm (bắt buộc lý do)")
	public void reject(@PathVariable ApprovalType type, @PathVariable UUID id,
			@Valid @RequestBody DecisionRequest request) {
		approvals.reject(type, id, request.note());
	}

}
