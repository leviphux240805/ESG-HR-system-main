package com.preschool.school.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.school.dto.SchoolDtos.SchoolDto;
import com.preschool.school.dto.SchoolDtos.SchoolRequest;
import com.preschool.school.service.SchoolService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Trường của tổ chức. */
@RestController
@RequestMapping("/api/v1/schools")
@Tag(name = "Trường")
public class SchoolController {

	private final SchoolService schools;

	public SchoolController(SchoolService schools) {
		this.schools = schools;
	}

	@GetMapping
	@Operation(summary = "Các trường của tôi (trường đã ngừng chỉ hiệu trưởng thấy)")
	public List<SchoolDto> list() {
		return schools.list();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Tạo trường mới; người tạo thành hiệu trưởng của trường")
	public SchoolDto create(@Valid @RequestBody SchoolRequest request) {
		return schools.create(request);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Sửa thông tin trường")
	public SchoolDto update(@PathVariable UUID id, @Valid @RequestBody SchoolRequest request) {
		return schools.update(id, request);
	}

	@PostMapping("/{id}/deactivate")
	@Operation(summary = "Ngừng hoạt động trường")
	public SchoolDto deactivate(@PathVariable UUID id) {
		return schools.setActive(id, false);
	}

	@PostMapping("/{id}/activate")
	@Operation(summary = "Mở lại trường đã ngừng")
	public SchoolDto activate(@PathVariable UUID id) {
		return schools.setActive(id, true);
	}

}
