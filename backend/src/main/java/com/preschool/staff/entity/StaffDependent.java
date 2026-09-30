package com.preschool.staff.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Người phụ thuộc để giảm trừ gia cảnh (thuế TNCN). Tháng lưu bằng ngày đầu tháng. */
@Entity
@Table(name = "staff_dependents")
public class StaffDependent extends BaseEntity {

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "full_name", nullable = false)
	private String fullName;

	@Column(nullable = false)
	private String relationship;

	private LocalDate dob;

	@Column(name = "id_number")
	private String idNumber;

	@Column(name = "from_month", nullable = false)
	private LocalDate fromMonth;

	@Column(name = "to_month")
	private LocalDate toMonth;

	protected StaffDependent() {
	}

	public StaffDependent(UUID staffId) {
		this.staffId = staffId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public String getFullName() {
		return fullName;
	}

	public void setFullName(String fullName) {
		this.fullName = fullName;
	}

	public String getRelationship() {
		return relationship;
	}

	public void setRelationship(String relationship) {
		this.relationship = relationship;
	}

	public LocalDate getDob() {
		return dob;
	}

	public void setDob(LocalDate dob) {
		this.dob = dob;
	}

	public String getIdNumber() {
		return idNumber;
	}

	public void setIdNumber(String idNumber) {
		this.idNumber = idNumber;
	}

	public LocalDate getFromMonth() {
		return fromMonth;
	}

	public void setFromMonth(LocalDate fromMonth) {
		this.fromMonth = fromMonth;
	}

	public LocalDate getToMonth() {
		return toMonth;
	}

	public void setToMonth(LocalDate toMonth) {
		this.toMonth = toMonth;
	}

}
