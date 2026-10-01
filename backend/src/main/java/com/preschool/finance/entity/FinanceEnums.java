package com.preschool.finance.entity;

/** Kiểu liệt kê của module Học phí & thu chi (khớp CHECK trong migration V10). */
public final class FinanceEnums {

	private FinanceEnums() {
	}

	/** Theo tháng, theo ngày học, một lần mỗi năm học, tự chọn. */
	public enum CalcMethod {
		MONTHLY, PER_DAY, ONE_TIME, OPTIONAL
	}

	/** Hoàn tiền ăn: chỉ ngày báo trước giờ báo ăn, mọi ngày vắng có phép, không hoàn. */
	public enum MealRefundRule {
		BEFORE_CUTOFF, ALL_EXCUSED, NONE
	}

	/** Khoản theo tháng khi nhập/nghỉ giữa tháng: thu đủ tháng hoặc chia theo ngày học. */
	public enum Proration {
		FULL_MONTH, BY_SCHOOL_DAYS
	}

	/** Nháp, Đã phát hành, Thu một phần, Đã thu đủ, Đã chuyển nợ sang phiếu sau, Đã hủy. */
	public enum InvoiceStatus {
		DRAFT, ISSUED, PARTIAL, PAID, CARRIED, CANCELLED
	}

	/** Khoản thu, hoàn tiền ăn, miễn giảm, số dư phiếu trước. */
	public enum LineKind {
		CHARGE, REFUND, DISCOUNT, CARRIED
	}

	public enum PaymentMethod {
		CASH, TRANSFER
	}

	public enum Direction {
		IN, OUT
	}

	/** Nhập tay, tự sinh từ thanh toán học phí, tự sinh từ lương đã trả. */
	public enum CashSource {
		MANUAL, PAYMENT, PAYROLL
	}

}
