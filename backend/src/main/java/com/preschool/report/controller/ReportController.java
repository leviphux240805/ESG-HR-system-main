package com.preschool.report.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import com.preschool.report.dto.ReportDtos.Dashboard;
import com.preschool.report.service.ReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Dashboard chuỗi/cơ sở và xuất Excel báo cáo. */
@RestController
@RequestMapping("/api/v1/reports")
@Tag(name = "Báo cáo")
public class ReportController {

	private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

	private final ReportService reports;

	public ReportController(ReportService reports) {
		this.reports = reports;
	}

	@GetMapping("/dashboard")
	@Operation(summary = "Dashboard: chỉ số từng cơ sở trong phạm vi đang chọn và tổng")
	public Dashboard dashboard(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return reports.dashboard(date);
	}

	@GetMapping("/{name}/export")
	@Operation(summary = "Xuất Excel: staff-attendance (bảng công, cần chọn cơ sở), payroll, receivables, children")
	@ApiResponse(responseCode = "200",
			content = @Content(mediaType = XLSX, schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> export(
			@Parameter(schema = @Schema(allowableValues = { "staff-attendance", "payroll", "receivables",
					"children" })) @PathVariable String name,
			@Parameter(example = "2026-09") @RequestParam String month) {
		ReportService.ExportFile file = reports.export(name, month);
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(XLSX))
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(file.fileName(), StandardCharsets.UTF_8).build().toString())
			.body(file.content());
	}

}
