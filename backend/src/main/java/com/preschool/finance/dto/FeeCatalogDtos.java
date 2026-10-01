package com.preschool.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.finance.entity.FinanceEnums.CalcMethod;
import com.preschool.finance.entity.FinanceEnums.MealRefundRule;
import com.preschool.finance.entity.FinanceEnums.Proration;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Khoản thu, biểu phí, khoản tự chọn và miễn giảm theo trẻ, cấu hình học phí. */
public final class FeeCatalogDtos {

	private FeeCatalogDtos() {
	}

	public record FeeTypeDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "HOC_PHI") String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) CalcMethod calcMethod,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean refundableOnAbsence,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int orderNo) {
	}

	public record CreateFeeTypeRequest(
			@NotBlank(message = "Vui lòng nhập mã khoản thu.") @Pattern(regexp = "[A-Z0-9_]{2,30}", message = "Mã gồm chữ in hoa, số, dấu gạch dưới (2–30 ký tự).") String code,
			@NotBlank(message = "Vui lòng nhập tên khoản thu.") @Size(max = 100, message = "Tên tối đa 100 ký tự.") String name,
			@NotNull(message = "Vui lòng chọn cách tính.") CalcMethod calcMethod,
			Boolean refundableOnAbsence,
			@Min(value = 0, message = "Thứ tự không hợp lệ.") int orderNo) {
	}

	public record UpdateFeeTypeRequest(
			@NotBlank(message = "Vui lòng nhập tên khoản thu.") @Size(max = 100, message = "Tên tối đa 100 ký tự.") String name,
			Boolean refundableOnAbsence,
			@NotNull Boolean active,
			@Min(value = 0, message = "Thứ tự không hợp lệ.") int orderNo) {
	}

	public record FeeScheduleDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolYearId,
			@Schema(description = "Rỗng = áp dụng mọi khối") UUID ageGroupId,
			String ageGroupName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID feeTypeId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String feeTypeName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) CalcMethod calcMethod,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate effectiveFrom,
			String note) {
	}

	@Schema(description = "Thêm mức phí. Đổi giá = thêm dòng mới với ngày hiệu lực mới; phiếu đã sinh không đổi.")
	public record FeeScheduleRequest(
			@NotNull(message = "Vui lòng chọn năm học.") UUID schoolYearId,
			UUID ageGroupId,
			@NotNull(message = "Vui lòng chọn khoản thu.") UUID feeTypeId,
			@NotNull(message = "Vui lòng nhập số tiền.") @DecimalMin(value = "0", message = "Số tiền không được âm.") @DecimalMax(value = "99999999999999", message = "Số tiền quá lớn.") BigDecimal amount,
			@NotNull(message = "Vui lòng chọn ngày hiệu lực.") LocalDate effectiveFrom,
			@Size(max = 500) String note) {
	}

	public record ChildFeeItemDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID feeTypeId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String feeTypeName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày đầu tháng") LocalDate fromMonth,
			LocalDate toMonth,
			String note) {
	}

	public record ChildFeeItemRequest(
			@NotNull(message = "Vui lòng chọn khoản thu.") UUID feeTypeId,
			@NotNull(message = "Vui lòng chọn tháng bắt đầu.") LocalDate fromMonth,
			LocalDate toMonth,
			@Size(max = 500) String note) {
	}

	public record ChildDiscountDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = giảm trên tổng các khoản") UUID feeTypeId,
			String feeTypeName,
			BigDecimal percent,
			BigDecimal amount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reason,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromMonth,
			LocalDate toMonth) {
	}

	@Schema(description = "Nhập đúng một trong hai: phần trăm hoặc số tiền")
	public record ChildDiscountRequest(
			UUID feeTypeId,
			@DecimalMin(value = "0.01", message = "Phần trăm phải lớn hơn 0.") @DecimalMax(value = "100", message = "Phần trăm không quá 100.") BigDecimal percent,
			@DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0.") @DecimalMax(value = "99999999999999", message = "Số tiền quá lớn.") BigDecimal amount,
			@NotBlank(message = "Vui lòng nhập lý do miễn giảm.") @Size(max = 200, message = "Lý do tối đa 200 ký tự.") String reason,
			@NotNull(message = "Vui lòng chọn tháng bắt đầu.") LocalDate fromMonth,
			LocalDate toMonth) {
	}

	public record FinanceConfigDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = cấu hình chung của tổ chức") UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate effectiveFrom,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) MealRefundRule mealRefundRule,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Proration proration,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int dueDay) {
	}

	public record FinanceConfigRequest(
			@Schema(description = "true = cấu hình chung của tổ chức (hiệu trưởng)") Boolean organizationWide,
			@NotNull(message = "Vui lòng chọn ngày hiệu lực.") LocalDate effectiveFrom,
			@NotNull(message = "Vui lòng chọn quy tắc hoàn tiền ăn.") MealRefundRule mealRefundRule,
			@NotNull(message = "Vui lòng chọn cách tính tháng nhập/nghỉ giữa chừng.") Proration proration,
			@Min(value = 1, message = "Hạn nộp từ ngày 1 đến 28.") @Max(value = 28, message = "Hạn nộp từ ngày 1 đến 28.") int dueDay) {
	}

}
