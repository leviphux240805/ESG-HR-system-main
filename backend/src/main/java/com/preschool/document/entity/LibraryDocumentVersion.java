package com.preschool.document.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Immutable;

/** Một phiên bản (tệp) của văn bản; truy cập qua văn bản (đã lọc theo cơ sở). Không sửa, chỉ thêm. */
@Entity
@Table(name = "library_document_versions")
@Immutable
public class LibraryDocumentVersion extends BaseEntity {

	@Column(name = "document_id", nullable = false)
	private UUID documentId;

	@Column(name = "version_no", nullable = false)
	private int versionNo;

	@Column(name = "file_id", nullable = false)
	private UUID fileId;

	private String note;

	protected LibraryDocumentVersion() {
	}

	public LibraryDocumentVersion(UUID documentId, int versionNo, UUID fileId, String note) {
		this.documentId = documentId;
		this.versionNo = versionNo;
		this.fileId = fileId;
		this.note = note;
	}

	public UUID getDocumentId() {
		return documentId;
	}

	public int getVersionNo() {
		return versionNo;
	}

	public UUID getFileId() {
		return fileId;
	}

	public String getNote() {
		return note;
	}

}
