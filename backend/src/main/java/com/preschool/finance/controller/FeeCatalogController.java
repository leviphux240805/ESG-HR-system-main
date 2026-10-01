package com.preschool.finance.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.finance.dto.FeeCatalogDtos.ChildDiscountDto;
import com.preschool.finance.dto.FeeCatalogDtos.ChildDiscountRequest;
import com.preschool.finance.dto.FeeCatalogDtos.ChildFeeItemDto;
import com.preschool.finance.dto.FeeCatalogDtos.ChildFeeItemRequest;
import com.preschool.finance.dto.FeeCatalogDtos.CreateFeeTypeRequest;
import com.preschool.finance.dto.FeeCatalogDtos.FeeScheduleDto;
import com.preschool.finance.dto.FeeCatalogDtos.FeeScheduleRequest;
import com.preschool.finance.dto.FeeCatalogDtos.FeeTypeDto;
import com.preschool.finance.dto.FeeCatalogDtos.FinanceConfigDto;
import com.preschool.finance.dto.FeeCatalogDtos.FinanceConfigRequest;
import com.preschool.finance.dto.FeeCatalogDtos.UpdateFeeTypeRequest;
import com.preschool.finance.service.FeeCatalogService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

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

/** Khoản thu, biểu phí, khoản tự chọn và miễn giảm theo trẻ, cấu hình học phí. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Học phí")
public class FeeCatalogController {

	private final FeeCatalogService catalog;

	public FeeCatalogController(FeeCatalogService catalog) {
		this.catalog = catalog;
	}

	@GetMapping("/fee-types")
	@Operation(summary = "Danh mục khoản thu")
	public List<FeeTypeDto> feeTypes() {
		return catalog.feeTypes();
	}

	@PostMapping("/fee-types")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm khoản thu (hiệu trưởng)")
	public FeeTypeDto createFeeType(@Valid @RequestBody CreateFeeTypeRequest request) {
		return catalog.createFeeType(request);
	}

	@PutMapping("/fee-types/{id}")
	@Operation(summary = "Sửa khoản thu (hiệu trưởng); không đổi được mã và cách tính")
	public FeeTypeDto updateFeeType(@PathVariable UUID id, @Valid @RequestBody UpdateFeeTypeRequest request) {
		return catalog.updateFeeType(id, request);
	}

	@GetMapping("/fee-schedules")
	@Operation(summary = "Biểu phí của cơ sở đang chọn")
	public List<FeeScheduleDto> schedules(@RequestParam(required = false) UUID schoolYearId) {
		return catalog.schedules(schoolYearId);
	}

	@PostMapping("/fee-schedules")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm mức phí cho cơ sở đang chọn (kế toán)")
	public FeeScheduleDto createSchedule(@Valid @RequestBody FeeScheduleRequest request) {
		return catalog.createSchedule(request);
	}

	@DeleteMapping("/fee-schedules/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa mức phí nhập nhầm (kế toán)")
	public void deleteSchedule(@PathVariable UUID id) {
		catalog.deleteSchedule(id);
	}

	@GetMapping("/children/{childId}/fee-items")
	@Operation(summary = "Khoản tự chọn trẻ đăng ký")
	public List<ChildFeeItemDto> feeItems(@PathVariable UUID childId) {
		return catalog.feeItems(childId);
	}

	@PostMapping("/children/{childId}/fee-items")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Đăng ký khoản tự chọn (kế toán)")
	public ChildFeeItemDto addFeeItem(@PathVariable UUID childId, @Valid @RequestBody ChildFeeItemRequest request) {
		return catalog.addFeeItem(childId, request);
	}

	@PutMapping("/children/{childId}/fee-items/{itemId}")
	@Operation(summary = "Sửa thời gian đăng ký khoản tự chọn (kế toán)")
	public ChildFeeItemDto updateFeeItem(@PathVariable UUID childId, @PathVariable UUID itemId,
			@Valid @RequestBody ChildFeeItemRequest request) {
		return catalog.updateFeeItem(childId, itemId, request);
	}

	@DeleteMapping("/children/{childId}/fee-items/{itemId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa khoản tự chọn (kế toán)")
	public void deleteFeeItem(@PathVariable UUID childId, @PathVariable UUID itemId) {
		catalog.deleteFeeItem(childId, itemId);
	}

	@GetMapping("/children/{childId}/discounts")
	@Operation(summary = "Miễn giảm của trẻ")
	public List<ChildDiscountDto> discounts(@PathVariable UUID childId) {
		return catalog.discounts(childId);
	}

	@PostMapping("/children/{childId}/discounts")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm miễn giảm (kế toán)")
	public ChildDiscountDto addDiscount(@PathVariable UUID childId, @Valid @RequestBody ChildDiscountRequest request) {
		return catalog.addDiscount(childId, request);
	}

	@PutMapping("/children/{childId}/discounts/{discountId}")
	@Operation(summary = "Sửa miễn giảm (kế toán)")
	public ChildDiscountDto updateDiscount(@PathVariable UUID childId, @PathVariable UUID discountId,
			@Valid @RequestBody ChildDiscountRequest request) {
		return catalog.updateDiscount(childId, discountId, request);
	}

	@DeleteMapping("/children/{childId}/discounts/{discountId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa miễn giảm (kế toán)")
	public void deleteDiscount(@PathVariable UUID childId, @PathVariable UUID discountId) {
		catalog.deleteDiscount(childId, discountId);
	}

	@GetMapping("/finance/configs")
	@Operation(summary = "Lịch sử cấu hình học phí áp dụng cho cơ sở đang chọn")
	public List<FinanceConfigDto> configs() {
		return catalog.configHistory();
	}

	@PostMapping("/finance/configs")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm cấu hình theo ngày hiệu lực (cơ sở: kế toán; cả tổ chức: hiệu trưởng)")
	public FinanceConfigDto createConfig(@Valid @RequestBody FinanceConfigRequest request) {
		return catalog.createConfig(request);
	}

}
