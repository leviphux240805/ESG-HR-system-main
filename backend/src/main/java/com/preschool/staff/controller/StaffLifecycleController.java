package com.preschool.staff.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import com.preschool.staff.dto.StaffActionDtos.BankRequest;
import com.preschool.staff.dto.StaffActionDtos.SalaryConfigDto;
import com.preschool.staff.dto.StaffActionDtos.SalaryConfigRequest;
import com.preschool.staff.dto.StaffActionDtos.StaffHistory;
import com.preschool.staff.dto.StaffActionDtos.TerminateRequest;
import com.preschool.staff.dto.StaffActionDtos.TransferRequest;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.StaffStatus;
import com.preschool.staff.service.StaffExportService;
import com.preschool.staff.service.StaffLifecycleService;
import com.preschool.staff.service.StaffService.ListFilter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Lương, ngân hàng, điều chuyển, nghỉ việc, lịch sử, xuất Excel. */
@RestController
@RequestMapping("/api/v1/staff")
@Tag(name = "Nhân sự")
public class StaffLifecycleController {

	private static final MediaType XLSX = MediaType
		.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

	private final StaffLifecycleService lifecycle;

	private final StaffExportService exportService;

	public StaffLifecycleController(StaffLifecycleService lifecycle, StaffExportService exportService) {
		this.lifecycle = lifecycle;
		this.exportService = exportService;
	}

	@GetMapping("/{staffId}/salary-configs")
	@Operation(summary = "Lịch sử cấu hình lương (hiệu trưởng không xem được)")
	public List<SalaryConfigDto> salaryConfigs(@PathVariable UUID staffId) {
		return lifecycle.salaryConfigs(staffId);
	}

	@PostMapping("/{staffId}/salary-configs")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Điều chỉnh lương: thêm cấu hình mới có ngày hiệu lực (không sửa bản cũ)")
	public SalaryConfigDto addSalaryConfig(@PathVariable UUID staffId,
			@Valid @RequestBody SalaryConfigRequest request) {
		return lifecycle.addSalaryConfig(staffId, request);
	}

	@PutMapping("/{staffId}/bank")
	@Operation(summary = "Cập nhật tài khoản ngân hàng nhận lương")
	public StaffDetail updateBank(@PathVariable UUID staffId, @Valid @RequestBody BankRequest request) {
		return lifecycle.updateBank(staffId, request);
	}

	@PostMapping("/{staffId}/transfer")
	@Operation(summary = "Điều chuyển cơ sở", description = "Ngày hiệu lực tương lai: hệ thống tự chuyển khi tới ngày.")
	public StaffDetail transfer(@PathVariable UUID staffId, @Valid @RequestBody TransferRequest request) {
		return lifecycle.transfer(staffId, request);
	}

	@PostMapping("/{staffId}/terminate")
	@Operation(summary = "Cho nghỉ việc (khóa tài khoản đăng nhập)")
	public StaffDetail terminate(@PathVariable UUID staffId, @Valid @RequestBody TerminateRequest request) {
		return lifecycle.terminate(staffId, request);
	}

	@GetMapping("/{staffId}/history")
	@Operation(summary = "Lịch sử: điều chuyển, thay đổi lương (nếu được xem), nhật ký chỉnh sửa")
	public StaffHistory history(@PathVariable UUID staffId) {
		return lifecycle.history(staffId);
	}

	@GetMapping("/export")
	@Operation(summary = "Xuất Excel danh sách nhân sự (theo bộ lọc hoặc theo danh sách id)")
	@ApiResponse(responseCode = "200", content = @Content(
			mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> export(@RequestParam(required = false) String q,
			@RequestParam(required = false) UUID schoolId, @RequestParam(required = false) Position position,
			@RequestParam(required = false) StaffStatus status,
			@RequestParam(defaultValue = "false") boolean contractExpiring,
			@RequestParam(required = false) List<UUID> ids) {
		byte[] body = exportService.export(new ListFilter(q, schoolId, position, status, contractExpiring), ids);
		String fileName = "Danh sách nhân sự " + DateTimeFormatter.ofPattern("dd-MM-yyyy").format(LocalDate.now())
				+ ".xlsx";
		return ResponseEntity.ok()
			.contentType(XLSX)
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
			.body(body);
	}

}
