package com.preschool.finance.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.web.PageResponse;
import com.preschool.finance.dto.CashDtos.CashCategoryDto;
import com.preschool.finance.dto.CashDtos.CashEntryDto;
import com.preschool.finance.dto.CashDtos.CashEntryRequest;
import com.preschool.finance.dto.CashDtos.CashSummary;
import com.preschool.finance.dto.CashDtos.CreateCashCategoryRequest;
import com.preschool.finance.dto.CashDtos.ReceivableRow;
import com.preschool.finance.dto.CashDtos.ReceivableSummary;
import com.preschool.finance.dto.CashDtos.UpdateCashCategoryRequest;
import com.preschool.finance.entity.FinanceEnums.Direction;
import com.preschool.finance.service.CashService;
import com.preschool.finance.service.CashService.EntryFilter;
import com.preschool.finance.service.InvoiceService;
import com.preschool.finance.service.InvoiceService.ReceivableFilter;

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

/** Công nợ học phí và sổ thu chi. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Thu chi")
public class CashController {

	private final CashService cash;

	private final InvoiceService invoices;

	public CashController(CashService cash, InvoiceService invoices) {
		this.cash = cash;
		this.invoices = invoices;
	}

	@GetMapping("/receivables")
	@Operation(summary = "Công nợ học phí theo trẻ (phiếu đang mở còn nợ)")
	public PageResponse<ReceivableRow> receivables(@RequestParam(required = false) UUID classId,
			@RequestParam(required = false) String q, @RequestParam(required = false) Boolean overdue,
			@ParameterObject Pageable pageable) {
		return invoices.receivables(new ReceivableFilter(classId, q, overdue), pageable);
	}

	@GetMapping("/receivables/summary")
	@Operation(summary = "Tổng công nợ học phí")
	public ReceivableSummary receivableSummary() {
		return invoices.receivableSummary();
	}

	@GetMapping("/cash-categories")
	@Operation(summary = "Danh mục thu chi")
	public List<CashCategoryDto> categories() {
		return cash.categories();
	}

	@PostMapping("/cash-categories")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm danh mục thu chi (hiệu trưởng)")
	public CashCategoryDto createCategory(@Valid @RequestBody CreateCashCategoryRequest request) {
		return cash.createCategory(request);
	}

	@PutMapping("/cash-categories/{id}")
	@Operation(summary = "Sửa danh mục thu chi (hiệu trưởng; không sửa danh mục hệ thống)")
	public CashCategoryDto updateCategory(@PathVariable UUID id,
			@Valid @RequestBody UpdateCashCategoryRequest request) {
		return cash.updateCategory(id, request);
	}

	@GetMapping("/cash-entries")
	@Operation(summary = "Sổ thu chi (cơ sở đang chọn hoặc mọi cơ sở được xem), mới nhất trước")
	public PageResponse<CashEntryDto> entries(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(required = false) Direction direction, @RequestParam(required = false) UUID categoryId,
			@RequestParam(required = false) String q, @ParameterObject Pageable pageable) {
		return cash.list(new EntryFilter(from, to, direction, categoryId, q), pageable);
	}

	@GetMapping("/cash-entries/summary")
	@Operation(summary = "Tổng thu, tổng chi và theo danh mục trong khoảng ngày")
	public CashSummary summary(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		return cash.summary(from, to);
	}

	@PostMapping("/cash-entries")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Nhập một khoản thu/chi ở cơ sở đang chọn (kế toán)")
	public CashEntryDto create(@Valid @RequestBody CashEntryRequest request) {
		return cash.create(request);
	}

	@PutMapping("/cash-entries/{id}")
	@Operation(summary = "Sửa khoản nhập tay (kế toán)")
	public CashEntryDto update(@PathVariable UUID id, @Valid @RequestBody CashEntryRequest request) {
		return cash.update(id, request);
	}

	@DeleteMapping("/cash-entries/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa khoản nhập tay (kế toán)")
	public void delete(@PathVariable UUID id) {
		cash.delete(id);
	}

	@GetMapping("/cash-entries/{id}/file-url")
	@Operation(summary = "Link xem chứng từ đính kèm")
	public DownloadUrlResponse fileUrl(@PathVariable UUID id) {
		return cash.fileUrl(id);
	}

}
