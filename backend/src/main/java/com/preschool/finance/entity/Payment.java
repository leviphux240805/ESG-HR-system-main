package com.preschool.finance.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.finance.entity.FinanceEnums.PaymentMethod;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một lần thu tiền cho phiếu. Không xóa: hủy kèm lý do để giữ dấu vết. */
@Entity
@Table(name = "payments")
@Filter(name = SchoolFilter.NAME)
public class Payment extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "invoice_id", nullable = false)
	private UUID invoiceId;

	@Column(nullable = false)
	private BigDecimal amount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private PaymentMethod method;

	@Column(name = "paid_on", nullable = false)
	private LocalDate paidOn;

	private String reference;

	private String note;

	@Column(name = "file_id")
	private UUID fileId;

	@Column(name = "received_by")
	private UUID receivedBy;

	@Column(name = "voided_at")
	private Instant voidedAt;

	@Column(name = "voided_by")
	private UUID voidedBy;

	@Column(name = "void_reason")
	private String voidReason;

	protected Payment() {
	}

	public Payment(UUID schoolId, UUID invoiceId, BigDecimal amount, PaymentMethod method, LocalDate paidOn,
			String reference, String note, UUID fileId, UUID receivedBy) {
		this.schoolId = schoolId;
		this.invoiceId = invoiceId;
		this.amount = amount;
		this.method = method;
		this.paidOn = paidOn;
		this.reference = reference;
		this.note = note;
		this.fileId = fileId;
		this.receivedBy = receivedBy;
	}

	public void voidPayment(String reason, Instant at, UUID by) {
		this.voidReason = reason;
		this.voidedAt = at;
		this.voidedBy = by;
	}

	public boolean isVoided() {
		return voidedAt != null;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getInvoiceId() {
		return invoiceId;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public PaymentMethod getMethod() {
		return method;
	}

	public LocalDate getPaidOn() {
		return paidOn;
	}

	public String getReference() {
		return reference;
	}

	public String getNote() {
		return note;
	}

	public UUID getFileId() {
		return fileId;
	}

	public UUID getReceivedBy() {
		return receivedBy;
	}

	public Instant getVoidedAt() {
		return voidedAt;
	}

	public String getVoidReason() {
		return voidReason;
	}

}
