package com.preschool.document.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Một phiên bản giấy tờ của nhân viên. Tải lên bản mới thì thêm dòng mới; bản mới nhất theo loại là bản hiện hành,
 * các bản cũ là lịch sử phiên bản. Truy cập qua hồ sơ nhân viên (đã lọc theo cơ sở).
 */
@Entity
@Table(name = "staff_documents")
public class StaffDocument extends BaseEntity {

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "document_type_id", nullable = false)
	private UUID documentTypeId;

	@Column(name = "file_id", nullable = false)
	private UUID fileId;

	@Column(name = "issued_date")
	private LocalDate issuedDate;

	@Column(name = "expiry_date")
	private LocalDate expiryDate;

	private String note;

	protected StaffDocument() {
	}

	public StaffDocument(UUID staffId, UUID documentTypeId, UUID fileId, LocalDate issuedDate, LocalDate expiryDate,
			String note) {
		this.staffId = staffId;
		this.documentTypeId = documentTypeId;
		this.fileId = fileId;
		this.issuedDate = issuedDate;
		this.expiryDate = expiryDate;
		this.note = note;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public UUID getDocumentTypeId() {
		return documentTypeId;
	}

	public UUID getFileId() {
		return fileId;
	}

	public LocalDate getIssuedDate() {
		return issuedDate;
	}

	public LocalDate getExpiryDate() {
		return expiryDate;
	}

	public String getNote() {
		return note;
	}

}
