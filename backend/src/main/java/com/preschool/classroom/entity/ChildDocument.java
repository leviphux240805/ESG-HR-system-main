package com.preschool.classroom.entity;

import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Giấy tờ của trẻ (khai sinh, BHYT, giấy khám sức khỏe…); loại lấy từ danh mục document_types scope CHILD. */
@Entity
@Table(name = "child_documents")
@Filter(name = SchoolFilter.NAME)
public class ChildDocument extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "document_type_id", nullable = false)
	private UUID documentTypeId;

	@Column(name = "file_id", nullable = false)
	private UUID fileId;

	@Column(name = "issued_date")
	private LocalDate issuedDate;

	@Column(name = "expiry_date")
	private LocalDate expiryDate;

	private String note;

	protected ChildDocument() {
	}

	public ChildDocument(UUID schoolId, UUID childId, UUID documentTypeId, UUID fileId, LocalDate issuedDate,
			LocalDate expiryDate, String note) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.documentTypeId = documentTypeId;
		this.fileId = fileId;
		this.issuedDate = issuedDate;
		this.expiryDate = expiryDate;
		this.note = note;
	}

	public UUID getChildId() {
		return childId;
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
