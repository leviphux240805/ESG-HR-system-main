package com.preschool.attendance.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.attendance.dto.LeaveDtos.BulkApproveRequest;
import com.preschool.attendance.dto.LeaveDtos.BulkApproveResult;
import com.preschool.attendance.dto.LeaveDtos.CalendarEntry;
import com.preschool.attendance.dto.LeaveDtos.CreateLeaveRequest;
import com.preschool.attendance.dto.LeaveDtos.LeaveBalanceDto;
import com.preschool.attendance.dto.LeaveDtos.LeaveRequestDto;
import com.preschool.attendance.dto.LeaveDtos.RejectRequest;
import com.preschool.attendance.dto.LeaveDtos.ReviewRequest;
import com.preschool.attendance.entity.LeaveRequest.Status;
import com.preschool.attendance.service.LeaveService;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Đơn nghỉ phép: của tôi (xin, hủy, phép còn lại) và duyệt (hiệu trưởng, văn phòng điều hành). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Nghỉ phép")
public class LeaveController {

	private final LeaveService leave;

	public LeaveController(LeaveService leave) {
		this.leave = leave;
	}

	@GetMapping("/me/leave-requests")
	@Operation(summary = "Đơn nghỉ của tôi (mới nhất trước)")
	public List<LeaveRequestDto> mine() {
		return leave.mine();
	}

	@PostMapping("/me/leave-requests")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Xin nghỉ (chặn trùng ngày, tháng đã khóa công, không đủ phép năm)")
	public LeaveRequestDto create(@Valid @RequestBody CreateLeaveRequest request) {
		return leave.create(request);
	}

	@PostMapping("/me/leave-requests/{id}/cancel")
	@Operation(summary = "Hủy đơn chưa duyệt")
	public LeaveRequestDto cancel(@PathVariable UUID id) {
		return leave.cancel(id);
	}

	@GetMapping("/me/leave-balance")
	@Operation(summary = "Phép năm của tôi")
	public LeaveBalanceDto balance(@RequestParam(required = false) Integer year) {
		return leave.myBalance(year);
	}

	@GetMapping("/leave-requests")
	@Operation(summary = "Đơn nghỉ theo cơ sở đang chọn; status=PENDING chỉ gồm đơn người xem được duyệt")
	public PageResponse<LeaveRequestDto> list(@RequestParam(required = false) Status status,
			@ParameterObject Pageable pageable) {
		return leave.list(status, pageable);
	}

	@PostMapping("/leave-requests/{id}/approve")
	@Operation(summary = "Duyệt: ghi mã vào bảng công, trừ phép năm, báo người xin")
	public LeaveRequestDto approve(@PathVariable UUID id, @Valid @RequestBody(required = false) ReviewRequest request) {
		return leave.approve(id, request == null ? null : request.note());
	}

	@PostMapping("/leave-requests/approve")
	@Operation(summary = "Duyệt nhiều đơn một lần (đơn lỗi được liệt kê, đơn khác vẫn duyệt)")
	public BulkApproveResult approveMany(@Valid @RequestBody BulkApproveRequest request) {
		return leave.approveMany(request.ids(), request.note());
	}

	@PostMapping("/leave-requests/{id}/reject")
	@Operation(summary = "Từ chối (cần lý do)")
	public LeaveRequestDto reject(@PathVariable UUID id, @Valid @RequestBody RejectRequest request) {
		return leave.reject(id, request.note());
	}

	@GetMapping("/leave-requests/calendar")
	@Operation(summary = "Lịch nghỉ tháng của cơ sở (đơn đã duyệt)")
	public List<CalendarEntry> calendar(@Parameter(example = "2026-09") @RequestParam String month) {
		return leave.calendar(month);
	}

	@GetMapping("/leave-requests/{id}/file-url")
	@Operation(summary = "Link xem tệp đính kèm của đơn")
	public DownloadUrlResponse fileUrl(@PathVariable UUID id) {
		return leave.fileUrl(id);
	}

}
