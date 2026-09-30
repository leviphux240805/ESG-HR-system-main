package com.preschool.staff.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Chứng chỉ bồi dưỡng/chuyên môn (có thể có ngày hết hạn → cảnh báo trước 30 ngày). */
@Entity
@Table(name = "staff_certificates")
public class StaffCertificate extends BaseEntity {

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(nullable = false)
	private String name;

	@Column(name = "issued_by")
	private String issuedBy;

	@Column(name = "issue_date")
	private LocalDate issueDate;

	@Column(name = "expiry_date")
	private LocalDate expiryDate;

	@Column(name = "file_id")
	private UUID fileId;

	protected StaffCertificate() {
	}

	public StaffCertificate(UUID staffId) {
		this.staffId = staffId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getIssuedBy() {
		return issuedBy;
	}

	public void setIssuedBy(String issuedBy) {
		this.issuedBy = issuedBy;
	}

	public LocalDate getIssueDate() {
		return issueDate;
	}

	public void setIssueDate(LocalDate issueDate) {
		this.issueDate = issueDate;
	}

	public LocalDate getExpiryDate() {
		return expiryDate;
	}

	public void setExpiryDate(LocalDate expiryDate) {
		this.expiryDate = expiryDate;
	}

	public UUID getFileId() {
		return fileId;
	}

	public void setFileId(UUID fileId) {
		this.fileId = fileId;
	}

}
