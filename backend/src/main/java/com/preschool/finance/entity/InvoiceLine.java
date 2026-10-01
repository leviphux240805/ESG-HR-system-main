package com.preschool.finance.entity;

import java.math.BigDecimal;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.finance.entity.FinanceEnums.LineKind;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một dòng phiếu thu; hoàn tiền và miễn giảm là số âm, số dư phiếu trước có thể âm (trả thừa). */
@Entity
@Table(name = "invoice_lines")
public class InvoiceLine extends BaseEntity {

	@Column(name = "fee_type_id")
	private UUID feeTypeId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private LineKind kind;

	@Column(nullable = false)
	private String description;

	@Column(nullable = false)
	private BigDecimal quantity;

	@Column(name = "unit_price", nullable = false)
	private BigDecimal unitPrice;

	@Column(nullable = false)
	private BigDecimal amount;

	private String note;

	@Column(name = "order_no", nullable = false)
	private int orderNo;

	protected InvoiceLine() {
	}

	public InvoiceLine(UUID feeTypeId, LineKind kind, String description, BigDecimal quantity, BigDecimal unitPrice,
			BigDecimal amount, String note, int orderNo) {
		this.feeTypeId = feeTypeId;
		this.kind = kind;
		this.description = description;
		this.quantity = quantity;
		this.unitPrice = unitPrice;
		this.amount = amount;
		this.note = note;
		this.orderNo = orderNo;
	}

	public UUID getFeeTypeId() {
		return feeTypeId;
	}

	public LineKind getKind() {
		return kind;
	}

	public String getDescription() {
		return description;
	}

	public BigDecimal getQuantity() {
		return quantity;
	}

	public BigDecimal getUnitPrice() {
		return unitPrice;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public String getNote() {
		return note;
	}

	public int getOrderNo() {
		return orderNo;
	}

}
