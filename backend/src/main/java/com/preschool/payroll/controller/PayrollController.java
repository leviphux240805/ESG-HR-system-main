package com.preschool.payroll.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import com.preschool.payroll.dto.PayrollDtos.AdjustRequest;
import com.preschool.payroll.dto.PayrollDtos.MyPayslip;
import com.preschool.payroll.dto.PayrollDtos.ParamsDto;
import com.preschool.payroll.dto.PayrollDtos.PayrollRow;
import com.preschool.payroll.dto.PayrollDtos.PayrollSheet;
import com.preschool.payroll.dto.PayrollDtos.Payslip;
import com.preschool.payroll.dto.PayrollDtos.ReopenRequest;
import com.preschool.payroll.service.PayrollService;
import com.preschool.payroll.service.PayslipDocumentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

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
import org.springframework.web.bind.annotation.RestController;

/** Bảng lương tháng theo trường đang chọn và phiếu lương. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Lương")
public class PayrollController {

	private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

	private final PayrollService payroll;

	private final PayslipDocumentService documents;

	public PayrollController(PayrollService payroll, PayslipDocumentService documents) {
		this.payroll = payroll;
		this.documents = documents;
	}

	@GetMapping("/payroll/periods/{month}")
	@Operation(summary = "Bảng lương tháng của trường đang chọn (rỗng nếu chưa tính)")
	public PayrollSheet sheet(@Parameter(example = "2026-09") @PathVariable String month) {
		return payroll.sheet(month);
	}

	@PostMapping("/payroll/periods/{month}/calculate")
	@Operation(summary = "Tính (lại) lương tháng từ bảng công đã khóa; giữ thưởng, phạt đã nhập")
	public PayrollSheet calculate(@PathVariable String month) {
		return payroll.calculate(month);
	}

	@PutMapping("/payroll/records/{id}")
	@Operation(summary = "Sửa thưởng, phạt, ghi chú của một người (bảng nháp)")
	public PayrollRow adjust(@PathVariable UUID id, @Valid @RequestBody AdjustRequest request) {
		return payroll.adjust(id, request);
	}

	@PostMapping("/payroll/periods/{month}/approve")
	@Operation(summary = "Duyệt bảng lương (hiệu trưởng); nhân viên nhận thông báo phiếu lương")
	public PayrollSheet approve(@PathVariable String month) {
		return payroll.approve(month);
	}

	@PostMapping("/payroll/periods/{month}/reopen")
	@Operation(summary = "Mở lại bảng lương đã duyệt, chưa trả (hiệu trưởng, kèm lý do)")
	public PayrollSheet reopen(@PathVariable String month, @Valid @RequestBody ReopenRequest request) {
		return payroll.reopen(month, request.reason());
	}

	@PostMapping("/payroll/periods/{month}/pay")
	@Operation(summary = "Đánh dấu đã trả lương")
	public PayrollSheet pay(@PathVariable String month) {
		return payroll.pay(month);
	}

	@GetMapping("/payroll/periods/{month}/export")
	@Operation(summary = "Xuất Excel bảng lương tháng")
	@ApiResponse(responseCode = "200", content = @Content(mediaType = XLSX, schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> export(@PathVariable String month) {
		return file(documents.excel(month), XLSX, documents.excelFileName(month));
	}

	@GetMapping("/payroll/records/{id}")
	@Operation(summary = "Phiếu lương chi tiết")
	public Payslip payslip(@PathVariable UUID id) {
		return payroll.payslip(id);
	}

	@GetMapping("/payroll/records/{id}/pdf")
	@Operation(summary = "Phiếu lương PDF")
	@ApiResponse(responseCode = "200", content = @Content(mediaType = "application/pdf", schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> payslipPdf(@PathVariable UUID id) {
		Payslip p = payroll.payslip(id);
		return file(documents.pdf(p), "application/pdf", documents.pdfFileName(p));
	}

	@GetMapping("/me/payslips")
	@Operation(summary = "Phiếu lương của tôi (bảng đã duyệt)")
	public List<MyPayslip> mine() {
		return payroll.mine();
	}

	@GetMapping("/payroll/params")
	@Operation(summary = "Tham số lương, bảo hiểm, thuế đang áp dụng")
	public ParamsDto params() {
		return payroll.currentParams();
	}

	private static ResponseEntity<byte[]> file(byte[] body, String type, String name) {
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(type))
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
			.body(body);
	}

}
