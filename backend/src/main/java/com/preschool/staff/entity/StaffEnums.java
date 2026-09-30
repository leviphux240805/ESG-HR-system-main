package com.preschool.staff.entity;

/** Các giá trị liệt kê của module nhân sự (khớp CHECK trong V3__nhan_su.sql). */
public final class StaffEnums {

	private StaffEnums() {
	}

	public enum Gender {
		MALE, FEMALE
	}

	/** Vị trí công việc trong trường mầm non. */
	public enum Position {
		TEACHER, NANNY, COOK, NURSE, ACCOUNTANT, SECURITY, MANAGER, OTHER
	}

	/** Trình độ chuyên môn cao nhất. */
	public enum Qualification {
		HIGH_SCHOOL, INTERMEDIATE, COLLEGE, BACHELOR, MASTER, OTHER
	}

	public enum StaffStatus {
		ACTIVE, TERMINATED
	}

	public enum ContractType {
		PROBATION, DEFINITE, INDEFINITE, SERVICE
	}

	/** Lương cứng (số tiền) hoặc lương hệ số (hệ số × lương cơ sở). */
	public enum SalaryMode {
		FIXED, COEFFICIENT
	}

	/** Vùng lương tối thiểu. */
	public enum SalaryRegion {
		I, II, III, IV
	}

	public enum ChangeRequestStatus {
		PENDING, APPROVED, REJECTED
	}

}
