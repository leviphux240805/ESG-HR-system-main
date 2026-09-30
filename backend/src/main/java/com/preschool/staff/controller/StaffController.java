package com.preschool.staff.controller;

import java.util.UUID;

import com.preschool.common.web.PageResponse;
import com.preschool.staff.dto.StaffDtos.CreateStaffRequest;
import com.preschool.staff.dto.StaffDtos.DuplicateCheckRequest;
import com.preschool.staff.dto.StaffDtos.DuplicateCheckResponse;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.dto.StaffDtos.StaffFields;
import com.preschool.staff.dto.StaffDtos.StaffListItem;
import com.preschool.staff.dto.StaffDtos.StaffSummary;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.StaffStatus;
import com.preschool.staff.service.StaffService;
import com.preschool.staff.service.StaffService.ListFilter;

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

@RestController
@RequestMapping("/api/v1/staff")
@Tag(name = "Nhân sự")
public class StaffController {

	private final StaffService staffService;

	public StaffController(StaffService staffService) {
		this.staffService = staffService;
	}

	@GetMapping
	@Operation(summary = "Danh sách nhân sự (theo cơ sở đang chọn)")
	public PageResponse<StaffListItem> list(
			@Parameter(description = "Tìm theo họ tên, mã NV, số điện thoại") @RequestParam(required = false) String q,
			@Parameter(description = "Lọc một cơ sở (khi đang xem tất cả cơ sở)") @RequestParam(required = false) UUID schoolId,
			@RequestParam(required = false) Position position, @RequestParam(required = false) StaffStatus status,
			@Parameter(description = "Chỉ nhân viên có hợp đồng hết hạn trong 30 ngày")
			@RequestParam(defaultValue = "false") boolean contractExpiring,
			@ParameterObject Pageable pageable) {
		return staffService.list(new ListFilter(q, schoolId, position, status, contractExpiring), pageable);
	}

	@GetMapping("/summary")
	@Operation(summary = "Tóm tắt nhân sự: tổng, theo vị trí, giấy tờ sắp hết hạn")
	public StaffSummary summary(@RequestParam(required = false) UUID schoolId) {
		return staffService.summary(schoolId);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Hồ sơ nhân viên (kèm quyền của người xem)")
	public StaffDetail get(@PathVariable UUID id) {
		return staffService.get(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm nhân viên (tùy chọn tạo tài khoản đăng nhập)")
	public StaffDetail create(@Valid @RequestBody CreateStaffRequest request) {
		return staffService.create(request);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Sửa hồ sơ (không gồm cơ sở, trạng thái, lương, ngân hàng)")
	public StaffDetail update(@PathVariable UUID id, @Valid @RequestBody StaffFields fields) {
		return staffService.update(id, fields);
	}

	@PostMapping("/check-duplicates")
	@Operation(summary = "Kiểm tra trùng CCCD/SĐT/email toàn chuỗi")
	public DuplicateCheckResponse checkDuplicates(@RequestBody DuplicateCheckRequest request) {
		return new DuplicateCheckResponse(staffService.checkDuplicates(request));
	}

}
