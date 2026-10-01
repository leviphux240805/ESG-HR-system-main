package com.preschool.finance.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.common.web.PageResponse;
import com.preschool.finance.dto.InvoiceDtos.CancelRequest;
import com.preschool.finance.dto.InvoiceDtos.GenerateRequest;
import com.preschool.finance.dto.InvoiceDtos.GenerateResult;
import com.preschool.finance.dto.InvoiceDtos.InvoiceDetail;
import com.preschool.finance.dto.InvoiceDtos.InvoiceRow;
import com.preschool.finance.dto.InvoiceDtos.InvoiceSummary;
import com.preschool.finance.dto.InvoiceDtos.IssueRequest;
import com.preschool.finance.dto.InvoiceDtos.IssueResult;
import com.preschool.finance.dto.InvoiceDtos.PaymentRequest;
import com.preschool.finance.dto.InvoiceDtos.VoidPaymentRequest;
import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.service.InvoiceDocumentService;
import com.preschool.finance.service.InvoiceService;
import com.preschool.finance.service.InvoiceService.ListFilter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Phiếu thu học phí: sinh, phát hành, hủy, thanh toán nhiều lần, in PDF, xuất Excel. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Học phí")
public class InvoiceController {

	private static final MediaType XLSX = MediaType
		.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

	private final InvoiceService invoices;

	private final InvoiceDocumentService documents;

	public InvoiceController(InvoiceService invoices, InvoiceDocumentService documents) {
		this.invoices = invoices;
		this.documents = documents;
	}

	@GetMapping("/invoices")
	@Operation(summary = "Phiếu thu của tháng (cơ sở đang chọn hoặc mọi cơ sở được xem)")
	public PageResponse<InvoiceRow> list(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate month,
			@RequestParam(required = false) UUID classId, @RequestParam(required = false) InvoiceStatus status,
			@RequestParam(required = false) String q, @RequestParam(required = false) Boolean overdue,
			@ParameterObject Pageable pageable) {
		return invoices.list(new ListFilter(month, classId, status, q, overdue), pageable);
	}

	@GetMapping("/invoices/summary")
	@Operation(summary = "Tổng hợp phiếu thu của tháng")
	public InvoiceSummary summary(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate month) {
		return invoices.summary(month);
	}

	@GetMapping("/invoices/export")
	@Operation(summary = "Xuất Excel phiếu thu của tháng theo bộ lọc")
	@ApiResponse(responseCode = "200", content = @Content(
			mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> export(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate month,
			@RequestParam(required = false) UUID classId, @RequestParam(required = false) InvoiceStatus status,
			@RequestParam(required = false) String q, @RequestParam(required = false) Boolean overdue) {
		byte[] body = documents.excel(new ListFilter(month, classId, status, q, overdue));
		return attachment(body, XLSX, "Phiếu thu " + month.getMonthValue() + "-" + month.getYear() + ".xlsx");
	}

	@PostMapping("/invoices/generate")
	@Operation(summary = "Sinh/tính lại phiếu nháp của tháng cho cơ sở đang chọn (kế toán)")
	public GenerateResult generate(@Valid @RequestBody GenerateRequest request) {
		return invoices.generate(request);
	}

	@PostMapping("/invoices/issue")
	@Operation(summary = "Phát hành các phiếu nháp của tháng (kế toán)")
	public IssueResult issueAll(@Valid @RequestBody IssueRequest request) {
		return invoices.issueAll(request);
	}

	@GetMapping("/invoices/{id}")
	@Operation(summary = "Chi tiết phiếu thu: các dòng và các lần thu")
	public InvoiceDetail detail(@PathVariable UUID id) {
		return invoices.detail(id);
	}

	@GetMapping("/invoices/{id}/pdf")
	@Operation(summary = "Phiếu thu dạng PDF")
	@ApiResponse(responseCode = "200",
			content = @Content(mediaType = "application/pdf", schema = @Schema(type = "string", format = "binary")))
	public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
		return attachment(documents.pdf(id), MediaType.APPLICATION_PDF, documents.pdfFileName(id));
	}

	@PostMapping("/invoices/{id}/issue")
	@Operation(summary = "Phát hành một phiếu nháp (kế toán)")
	public InvoiceDetail issue(@PathVariable UUID id) {
		return invoices.issue(id);
	}

	@PostMapping("/invoices/{id}/cancel")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Hủy phiếu (nháp: xóa; đã phát hành: cần lý do, chưa có lần thu) (kế toán)")
	public void cancel(@PathVariable UUID id, @Valid @RequestBody(required = false) CancelRequest request) {
		invoices.cancel(id, request);
	}

	@PostMapping("/invoices/{id}/payments")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Ghi nhận một lần thu (kế toán, hiệu trưởng); tự ghi sổ thu chi")
	public InvoiceDetail addPayment(@PathVariable UUID id, @Valid @RequestBody PaymentRequest request) {
		return invoices.addPayment(id, request);
	}

	@PostMapping("/invoices/{id}/payments/{paymentId}/void")
	@Operation(summary = "Hủy một lần thu nhập nhầm (kế toán)")
	public InvoiceDetail voidPayment(@PathVariable UUID id, @PathVariable UUID paymentId,
			@Valid @RequestBody VoidPaymentRequest request) {
		return invoices.voidPayment(id, paymentId, request);
	}

	@GetMapping("/children/{childId}/invoices")
	@Operation(summary = "Phiếu thu của một trẻ")
	public List<InvoiceRow> childInvoices(@PathVariable UUID childId) {
		return invoices.childInvoices(childId);
	}

	private static ResponseEntity<byte[]> attachment(byte[] body, MediaType type, String fileName) {
		return ResponseEntity.ok()
			.contentType(type)
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
			.body(body);
	}

}
