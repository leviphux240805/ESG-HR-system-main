package com.preschool.finance.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.entity.FinanceEnums.LineKind;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.SQLRestriction;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * Phiếu thu tháng của một trẻ. Nháp thì tính lại được; đã phát hành thì không sửa, muốn sửa phải hủy rồi sinh lại.
 * Khi phiếu tháng sau nhận số dư, phiếu này thành {@link InvoiceStatus#CARRIED} và không nhận thanh toán nữa.
 */
@Entity
@Table(name = "invoices")
@Filter(name = SchoolFilter.NAME)
@SQLRestriction("deleted_at IS NULL")
public class Invoice extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "class_id")
	private UUID classId;

	@Column(name = "period_month", nullable = false)
	private LocalDate periodMonth;

	@Column(name = "invoice_no")
	private String invoiceNo;

	@Column(nullable = false)
	private BigDecimal subtotal = BigDecimal.ZERO;

	@Column(nullable = false)
	private BigDecimal discount = BigDecimal.ZERO;

	@Column(nullable = false)
	private BigDecimal refund = BigDecimal.ZERO;

	@Column(name = "carried_balance", nullable = false)
	private BigDecimal carriedBalance = BigDecimal.ZERO;

	@Column(name = "amount_due", nullable = false)
	private BigDecimal amountDue = BigDecimal.ZERO;

	@Column(name = "amount_paid", nullable = false)
	private BigDecimal amountPaid = BigDecimal.ZERO;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private InvoiceStatus status = InvoiceStatus.DRAFT;

	@Column(name = "due_date")
	private LocalDate dueDate;

	@Column(name = "issued_at")
	private Instant issuedAt;

	@Column(name = "issued_by")
	private UUID issuedBy;

	@Column(name = "carried_to_id")
	private UUID carriedToId;

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "cancel_reason")
	private String cancelReason;

	private String note;

	@Column(name = "deleted_at")
	private Instant deletedAt;

	@OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
	@JoinColumn(name = "invoice_id", nullable = false)
	@OrderBy("orderNo")
	private List<InvoiceLine> lines = new ArrayList<>();

	protected Invoice() {
	}

	public Invoice(UUID schoolId, UUID childId, LocalDate periodMonth) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.periodMonth = periodMonth;
	}

	/** Thay toàn bộ dòng của phiếu nháp và tính lại các tổng. */
	public void replaceLines(UUID classId, LocalDate dueDate, List<InvoiceLine> newLines) {
		this.classId = classId;
		this.dueDate = dueDate;
		lines.clear();
		lines.addAll(newLines);
		subtotal = sum(LineKind.CHARGE);
		discount = sum(LineKind.DISCOUNT).negate();
		refund = sum(LineKind.REFUND).negate();
		carriedBalance = sum(LineKind.CARRIED);
		amountDue = subtotal.subtract(discount).subtract(refund).add(carriedBalance);
	}

	private BigDecimal sum(LineKind kind) {
		return lines.stream()
			.filter(l -> l.getKind() == kind)
			.map(InvoiceLine::getAmount)
			.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public void issue(String invoiceNo, Instant at, UUID by) {
		this.invoiceNo = invoiceNo;
		this.issuedAt = at;
		this.issuedBy = by;
		this.status = InvoiceStatus.ISSUED;
		refreshPaymentStatus();
	}

	/** Cập nhật số đã thu và trạng thái thu (chỉ phiếu đang mở). */
	public void setAmountPaid(BigDecimal amountPaid) {
		this.amountPaid = amountPaid;
		refreshPaymentStatus();
	}

	private void refreshPaymentStatus() {
		if (!isOpen()) {
			return;
		}
		if (amountPaid.compareTo(amountDue) >= 0) {
			status = InvoiceStatus.PAID;
		}
		else {
			status = amountPaid.signum() > 0 ? InvoiceStatus.PARTIAL : InvoiceStatus.ISSUED;
		}
	}

	/** Số dư phiếu tháng sau đã nhận. */
	public void carryTo(UUID invoiceId) {
		this.carriedToId = invoiceId;
		this.status = InvoiceStatus.CARRIED;
	}

	/** Phiếu nhận số dư bị hủy: phiếu này mở lại để thu tiếp. */
	public void reopen() {
		this.carriedToId = null;
		this.status = InvoiceStatus.ISSUED;
		refreshPaymentStatus();
	}

	public void cancel(String reason, Instant at) {
		this.status = InvoiceStatus.CANCELLED;
		this.cancelReason = reason;
		this.cancelledAt = at;
	}

	public void softDelete(Instant at) {
		this.deletedAt = at;
	}

	/** Đã phát hành và còn nhận thanh toán. */
	public boolean isOpen() {
		return status == InvoiceStatus.ISSUED || status == InvoiceStatus.PARTIAL || status == InvoiceStatus.PAID;
	}

	/** Còn phải thu (âm = trả thừa). */
	public BigDecimal getBalance() {
		return amountDue.subtract(amountPaid);
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getChildId() {
		return childId;
	}

	public UUID getClassId() {
		return classId;
	}

	public LocalDate getPeriodMonth() {
		return periodMonth;
	}

	public String getInvoiceNo() {
		return invoiceNo;
	}

	public BigDecimal getSubtotal() {
		return subtotal;
	}

	public BigDecimal getDiscount() {
		return discount;
	}

	public BigDecimal getRefund() {
		return refund;
	}

	public BigDecimal getCarriedBalance() {
		return carriedBalance;
	}

	public BigDecimal getAmountDue() {
		return amountDue;
	}

	public BigDecimal getAmountPaid() {
		return amountPaid;
	}

	public InvoiceStatus getStatus() {
		return status;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public Instant getIssuedAt() {
		return issuedAt;
	}

	public UUID getIssuedBy() {
		return issuedBy;
	}

	public UUID getCarriedToId() {
		return carriedToId;
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public String getCancelReason() {
		return cancelReason;
	}

	public String getNote() {
		return note;
	}

	public void setNote(String note) {
		this.note = note;
	}

	public List<InvoiceLine> getLines() {
		return lines;
	}

}
