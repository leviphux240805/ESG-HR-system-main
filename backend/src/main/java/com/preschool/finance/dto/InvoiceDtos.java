package com.preschool.finance.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.entity.FinanceEnums.LineKind;
import com.preschool.finance.entity.FinanceEnums.PaymentMethod;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Phiếu thu học phí: sinh, phát hành, hủy, thanh toán nhiều lần. */
public final class InvoiceDtos {

	private InvoiceDtos() {
	}

	public record InvoiceRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String childName,
			String childCode,
			UUID classId,
			String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày đầu tháng") LocalDate periodMonth,
			String invoiceNo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal subtotal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal discount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal refund,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Dương = nợ cũ, âm = trả thừa") BigDecimal carriedBalance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amountDue,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amountPaid,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Còn phải thu (âm = trả thừa)") BigDecimal balance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) InvoiceStatus status,
			LocalDate dueDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Quá hạn mà chưa thu đủ") boolean overdue) {
	}

	public record InvoiceLineDto(
			UUID feeTypeId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LineKind kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String description,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal quantity,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal unitPrice,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Có dấu: hoàn tiền, miễn giảm là số âm") BigDecimal amount,
			String note) {
	}

	public record PaymentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) PaymentMethod method,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate paidOn,
			String reference,
			String note,
			UUID fileId,
			String receivedByName,
			Instant voidedAt,
			String voidReason) {
	}

	public record InvoiceDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) InvoiceRow invoice,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<InvoiceLineDto> lines,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PaymentDto> payments,
			Instant issuedAt,
			String note,
			String cancelReason,
			@Schema(description = "Phiếu tháng sau đã nhận số dư") UUID carriedToId,
			String carriedToNo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManage,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canCollect) {
	}

	public record GenerateRequest(
			@NotNull(message = "Vui lòng chọn tháng.") LocalDate month,
			@Schema(description = "Chỉ sinh cho các trẻ này (rỗng = mọi trẻ đang học trong tháng)") List<UUID> childIds) {
	}

	public record GenerateWarning(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String childName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {
	}

	@Schema(description = "Kết quả sinh phiếu: phiếu nháp được tính lại; phiếu đã phát hành giữ nguyên")
	public record GenerateResult(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int created,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int updated,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đã phát hành, không tính lại") int skipped,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<GenerateWarning> warnings) {
	}

	public record IssueRequest(
			@NotNull(message = "Vui lòng chọn tháng.") LocalDate month,
			@Schema(description = "Rỗng = mọi phiếu nháp của tháng") List<UUID> ids) {
	}

	public record IssueResult(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int issued) {
	}

	public record CancelRequest(@Size(max = 300, message = "Lý do tối đa 300 ký tự.") String reason) {
	}

	public record PaymentRequest(
			@NotNull(message = "Vui lòng nhập số tiền.") @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0.") @DecimalMax(value = "99999999999999", message = "Số tiền quá lớn.") BigDecimal amount,
			@NotNull(message = "Vui lòng chọn hình thức.") PaymentMethod method,
			@NotNull(message = "Vui lòng chọn ngày thu.") LocalDate paidOn,
			@Size(max = 100, message = "Mã giao dịch tối đa 100 ký tự.") String reference,
			@Size(max = 300, message = "Ghi chú tối đa 300 ký tự.") String note,
			UUID fileId) {
	}

	public record VoidPaymentRequest(
			@NotBlank(message = "Vui lòng nhập lý do hủy.") @Size(max = 300, message = "Lý do tối đa 300 ký tự.") String reason) {
	}

	public record InvoiceSummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long draft,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long issued,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long partial,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long paid,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long carried,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Tổng phải thu của phiếu đã phát hành") BigDecimal amountDue,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amountPaid,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal balance) {
	}

}
