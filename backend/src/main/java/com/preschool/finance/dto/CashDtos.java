package com.preschool.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.FinanceEnums.CashSource;
import com.preschool.finance.entity.FinanceEnums.Direction;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Sổ thu chi, danh mục thu chi, công nợ học phí. */
public final class CashDtos {

	private CashDtos() {
	}

	public record CashCategoryDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Direction direction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Danh mục của dòng tự sinh (học phí, lương), không chọn khi nhập tay") boolean system,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int orderNo) {
	}

	public record CreateCashCategoryRequest(
			@NotNull(message = "Vui lòng chọn loại thu hoặc chi.") Direction direction,
			@NotBlank(message = "Vui lòng nhập tên danh mục.") @Size(max = 100, message = "Tên tối đa 100 ký tự.") String name,
			@Min(value = 0, message = "Thứ tự không hợp lệ.") int orderNo) {
	}

	public record UpdateCashCategoryRequest(
			@NotBlank(message = "Vui lòng nhập tên danh mục.") @Size(max = 100, message = "Tên tối đa 100 ký tự.") String name,
			@NotNull Boolean active,
			@Min(value = 0, message = "Thứ tự không hợp lệ.") int orderNo) {
	}

	public record CashEntryDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID categoryId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String categoryName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Direction direction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate entryDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String description,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) CashSource source,
			@Schema(description = "Phiếu thu của dòng tự sinh từ thanh toán học phí") UUID invoiceId,
			UUID fileId,
			String createdByName) {
	}

	public record CashEntryRequest(
			@NotNull(message = "Vui lòng chọn danh mục.") UUID categoryId,
			@NotNull(message = "Vui lòng nhập số tiền.") @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0.") @DecimalMax(value = "99999999999999", message = "Số tiền quá lớn.") BigDecimal amount,
			@NotNull(message = "Vui lòng chọn ngày.") LocalDate entryDate,
			@NotBlank(message = "Vui lòng nhập nội dung.") @Size(max = 300, message = "Nội dung tối đa 300 ký tự.") String description,
			UUID fileId) {
	}

	public record CategoryTotal(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID categoryId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String categoryName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Direction direction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amount) {
	}

	public record CashSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal totalIn,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal totalOut,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal net,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CategoryTotal> byCategory) {
	}

	public record ReceivableRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String childName,
			String childCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số phiếu còn nợ") int invoiceCount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal balance,
			@Schema(description = "Hạn nộp sớm nhất của các phiếu còn nợ") LocalDate oldestDueDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số ngày quá hạn (0 = chưa quá hạn)") int overdueDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Phiếu còn nợ mới nhất") UUID latestInvoiceId) {
	}

	public record ReceivableSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int children,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal balance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int overdueChildren,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal overdueBalance) {
	}

}
