package com.preschool.classroom.controller;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.classroom.dto.AttendanceDtos.RollCallLockRequest;
import com.preschool.classroom.dto.AttendanceDtos.MarkRequest;
import com.preschool.classroom.dto.AttendanceDtos.RollCall;
import com.preschool.classroom.dto.AttendanceDtos.RollCallUnlockRequest;
import com.preschool.classroom.service.ChildAttendanceService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Điểm danh trẻ theo lớp và ngày. */
@RestController
@RequestMapping("/api/v1/classes/{id}/attendance")
@Tag(name = "Điểm danh trẻ")
public class ChildAttendanceController {

	private final ChildAttendanceService service;

	public ChildAttendanceController(ChildAttendanceService service) {
		this.service = service;
	}

	@GetMapping
	@Operation(summary = "Danh sách điểm danh của lớp trong ngày (rỗng = hôm nay)")
	public RollCall rollCall(@PathVariable UUID id, @RequestParam(required = false) LocalDate date) {
		return service.rollCall(id, date);
	}

	@PutMapping
	@Operation(summary = "Điểm danh cả lớp một lần")
	public RollCall mark(@PathVariable UUID id, @Valid @RequestBody MarkRequest request) {
		return service.mark(id, request);
	}

	@PostMapping("/lock")
	@Operation(summary = "Chốt điểm danh trong ngày (đủ cả lớp)")
	public RollCall lock(@PathVariable UUID id, @Valid @RequestBody RollCallLockRequest request) {
		return service.lock(id, request.date());
	}

	@PostMapping("/unlock")
	@Operation(summary = "Mở lại ngày đã chốt (hiệu trưởng, kèm lý do)")
	public RollCall unlock(@PathVariable UUID id, @Valid @RequestBody RollCallUnlockRequest request) {
		return service.unlock(id, request.date(), request.reason());
	}

}
