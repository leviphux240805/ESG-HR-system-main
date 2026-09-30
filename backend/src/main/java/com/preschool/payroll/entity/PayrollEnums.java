package com.preschool.payroll.entity;

/** Kiểu liệt kê của module Lương (khớp CHECK trong migration V8). */
public final class PayrollEnums {

	private PayrollEnums() {
	}

	/** Nháp → Đã duyệt → Đã trả; đã duyệt thì bảng lương không sửa được. */
	public enum PeriodStatus {
		DRAFT, APPROVED, PAID
	}

}
