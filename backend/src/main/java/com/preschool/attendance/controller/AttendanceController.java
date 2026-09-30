package com.preschool.attendance.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.attendance.dto.AttendanceDtos.CellDetail;
import com.preschool.attendance.dto.AttendanceDtos.DiscrepancyItem;
import com.preschool.attendance.dto.AttendanceDtos.ImportRequest;
import com.preschool.attendance.dto.AttendanceDtos.ImportResult;
import com.preschool.attendance.dto.AttendanceDtos.MonthSheet;
import com.preschool.attendance.dto.AttendanceDtos.ResolveRequest;
import com.preschool.attendance.dto.AttendanceDtos.UnlockRequest;
import com.preschool.attendance.dto.AttendanceDtos.UpdateCellRequest;
import com.preschool.attendance.service.AttendanceExportService;
import com.preschool.attendance.service.AttendanceLockService;
import com.preschool.attendance.service.AttendanceService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Bảng công tháng của cơ sở đang chọn: xem, sửa ô, import máy chấm công, xử lý sai lệch. */
@RestController
@RequestMapping("/api/v1/attendance")
@Tag(name = "Chấm công")
public class AttendanceController {

	private final AttendanceService service;

	private final AttendanceLockService lockService;

	private final AttendanceExportService exportService;

	public AttendanceController(AttendanceService service, AttendanceLockService lockService,
			AttendanceExportService exportService) {
		this.service = service;
		this.lockService = lockService;
		this.exportService = exportService;
	}

	@GetMapping("/staff")
	@Operation(summary = "Bảng công tháng (nhân viên × ngày, tổng, trạng thái khóa)")
	public MonthSheet sheet(@Parameter(example = "2026-09") @RequestParam String month) {
		return service.sheet(month);
	}

	@GetMapping("/staff/{staffId}/{date}")
	@Operation(summary = "Chi tiết một ô: mã, giờ máy, lý do sai lệch, gợi ý")
	public CellDetail cell(@PathVariable UUID staffId,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return service.cell(staffId, date);
	}

	@PutMapping("/staff/{staffId}/{date}")
	@Operation(summary = "Sửa mã công/ghi chú của một ngày (tháng chưa khóa)")
	public CellDetail updateCell(@PathVariable UUID staffId,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@Valid @RequestBody UpdateCellRequest request) {
		return service.updateCell(staffId, date, request);
	}

	@PostMapping("/imports")
	@Operation(summary = "Import dữ liệu máy chấm công (đã đọc từ Excel ở trình duyệt) và đối soát cả tháng")
	public ImportResult importPunches(@Valid @RequestBody ImportRequest request) {
		return service.importPunches(request);
	}

	@GetMapping("/discrepancies")
	@Operation(summary = "Các ngày sai lệch giữa máy chấm công và bảng công")
	public List<DiscrepancyItem> discrepancies(@Parameter(example = "2026-09") @RequestParam String month) {
		return service.discrepancies(month);
	}

	@PostMapping("/discrepancies/resolve")
	@Operation(summary = "Xác nhận mã cho nhiều ngày sai lệch một lần")
	public Map<String, Integer> resolve(@Valid @RequestBody ResolveRequest request) {
		return Map.of("resolved", service.resolve(request));
	}

	@PostMapping("/months/{month}/lock")
	@Operation(summary = "Khóa công tháng (chốt tổng tháng; sau đó chỉ xem)")
	public MonthSheet lock(@Parameter(example = "2026-09") @PathVariable String month) {
		return lockService.lock(month);
	}

	@PostMapping("/months/{month}/unlock")
	@Operation(summary = "Mở khóa công tháng (văn phòng điều hành, bắt buộc lý do)")
	public MonthSheet unlock(@Parameter(example = "2026-09") @PathVariable String month,
			@Valid @RequestBody UnlockRequest request) {
		return lockService.unlock(month, request.reason());
	}

	@GetMapping("/months/{month}/export")
	@Operation(summary = "Xuất Excel bảng công tháng")
	@ApiResponse(responseCode = "200", content = @Content(
			mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> export(@Parameter(example = "2026-09") @PathVariable String month) {
		AttendanceExportService.ExportFile file = exportService.export(month);
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(file.fileName(), StandardCharsets.UTF_8).build().toString())
			.body(file.content());
	}

}
