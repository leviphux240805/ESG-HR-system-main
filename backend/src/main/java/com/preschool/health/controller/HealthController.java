package com.preschool.health.controller;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.web.PageResponse;
import com.preschool.health.dto.HealthDtos.CheckupDto;
import com.preschool.health.dto.HealthDtos.CheckupRequest;
import com.preschool.health.dto.HealthDtos.ChildHealth;
import com.preschool.health.dto.HealthDtos.ClassMeasurementSheet;
import com.preschool.health.dto.HealthDtos.HealthLogDto;
import com.preschool.health.dto.HealthDtos.HealthLogRequest;
import com.preschool.health.dto.HealthDtos.SaveMeasurementsRequest;
import com.preschool.health.entity.HealthEnums.HealthLogType;
import com.preschool.health.service.HealthService;
import com.preschool.health.service.HealthService.LogFilter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Cân đo, biểu đồ tăng trưởng, sổ theo dõi sức khỏe, khám định kỳ. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Sức khỏe")
public class HealthController {

	private final HealthService health;

	public HealthController(HealthService health) {
		this.health = health;
	}

	@GetMapping("/classes/{classId}/measurements")
	@Operation(summary = "Bảng cân đo của lớp vào một ngày (mặc định hôm nay), kèm lần cân trước")
	public ClassMeasurementSheet classSheet(@PathVariable UUID classId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return health.classSheet(classId, date);
	}

	@PutMapping("/classes/{classId}/measurements")
	@Operation(summary = "Nhập cân đo cả lớp; hệ thống xếp kênh theo chuẩn WHO")
	public ClassMeasurementSheet saveClass(@PathVariable UUID classId,
			@Valid @RequestBody SaveMeasurementsRequest request) {
		return health.saveClass(classId, request);
	}

	@DeleteMapping("/measurements/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa một lần cân đo nhập nhầm")
	public void deleteMeasurement(@PathVariable UUID id) {
		health.deleteMeasurement(id);
	}

	@GetMapping("/children/{childId}/health")
	@Operation(summary = "Sức khỏe của trẻ: biểu đồ tăng trưởng, khám định kỳ, sổ theo dõi gần đây")
	public ChildHealth childHealth(@PathVariable UUID childId) {
		return health.childHealth(childId);
	}

	@PostMapping("/children/{childId}/checkups")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Ghi kết quả khám sức khỏe định kỳ")
	public CheckupDto addCheckup(@PathVariable UUID childId, @Valid @RequestBody CheckupRequest request) {
		return health.addCheckup(childId, request);
	}

	@DeleteMapping("/checkups/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa kết quả khám")
	public void deleteCheckup(@PathVariable UUID id) {
		health.deleteCheckup(id);
	}

	@GetMapping("/checkups/{id}/file-url")
	@Operation(summary = "Link xem file biên bản khám")
	public DownloadUrlResponse checkupFileUrl(@PathVariable UUID id) {
		return health.checkupFileUrl(id);
	}

	@GetMapping("/health-logs")
	@Operation(summary = "Sổ theo dõi sức khỏe hằng ngày")
	public PageResponse<HealthLogDto> logs(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(required = false) UUID classId, @RequestParam(required = false) UUID childId,
			@RequestParam(required = false) HealthLogType type, @RequestParam(required = false) String q,
			@ParameterObject Pageable pageable) {
		return health.logs(new LogFilter(from, to, classId, childId, type, q), pageable);
	}

	@PostMapping("/health-logs")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Ghi sổ theo dõi")
	public HealthLogDto createLog(@Valid @RequestBody HealthLogRequest request) {
		return health.createLog(request);
	}

	@PutMapping("/health-logs/{id}")
	@Operation(summary = "Sửa ghi chép")
	public HealthLogDto updateLog(@PathVariable UUID id, @Valid @RequestBody HealthLogRequest request) {
		return health.updateLog(id, request);
	}

	@PostMapping("/health-logs/{id}/notify-parent")
	@Operation(summary = "Đánh dấu đã báo phụ huynh")
	public HealthLogDto notifyParent(@PathVariable UUID id) {
		return health.notifyParent(id);
	}

	@DeleteMapping("/health-logs/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa ghi chép")
	public void deleteLog(@PathVariable UUID id) {
		health.deleteLog(id);
	}

}
