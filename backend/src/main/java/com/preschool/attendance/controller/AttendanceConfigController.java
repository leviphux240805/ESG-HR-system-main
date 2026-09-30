package com.preschool.attendance.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.attendance.dto.AttendanceConfigDtos.ConfigDto;
import com.preschool.attendance.dto.AttendanceConfigDtos.ConfigOverview;
import com.preschool.attendance.dto.AttendanceConfigDtos.CreateConfigRequest;
import com.preschool.attendance.dto.AttendanceConfigDtos.CreateHolidayRequest;
import com.preschool.attendance.dto.AttendanceConfigDtos.HolidayDto;
import com.preschool.attendance.service.AttendanceConfigService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Cấu hình chấm công theo cơ sở và ngày lễ. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Chấm công")
public class AttendanceConfigController {

	private final AttendanceConfigService service;

	public AttendanceConfigController(AttendanceConfigService service) {
		this.service = service;
	}

	@GetMapping("/attendance/configs")
	@Operation(summary = "Cấu hình chấm công của cơ sở (bản đang áp dụng + lịch sử)",
			description = "Bỏ trống schoolId = mặc định toàn chuỗi.")
	public ConfigOverview configs(@RequestParam(required = false) UUID schoolId) {
		return service.overview(schoolId);
	}

	@PostMapping("/attendance/configs")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm bản cấu hình mới có ngày hiệu lực (không sửa bản cũ)")
	public ConfigDto createConfig(@Valid @RequestBody CreateConfigRequest request) {
		return service.create(request);
	}

	@GetMapping("/holidays")
	@Operation(summary = "Ngày lễ trong năm (toàn chuỗi + cơ sở trong phạm vi)")
	public List<HolidayDto> holidays(@Parameter(example = "2026") @RequestParam int year) {
		return service.listHolidays(year);
	}

	@PostMapping("/holidays")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm ngày lễ (một ngày hoặc khoảng ngày)")
	public List<HolidayDto> addHolidays(@Valid @RequestBody CreateHolidayRequest request) {
		return service.addHolidays(request);
	}

	@DeleteMapping("/holidays/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteHoliday(@PathVariable UUID id) {
		service.deleteHoliday(id);
	}

}
