package com.preschool.document.entity;

import java.time.Instant;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Immutable;

/** Nhân viên xác nhận đã đọc một phiên bản văn bản. */
@Entity
@Table(name = "document_acks")
@Immutable
public class DocumentAck extends BaseEntity {

	@Column(name = "document_id", nullable = false)
	private UUID documentId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "version_no", nullable = false)
	private int versionNo;

	@Column(name = "acknowledged_at", nullable = false)
	private Instant acknowledgedAt;

	protected DocumentAck() {
	}

	public DocumentAck(UUID documentId, UUID staffId, int versionNo, Instant acknowledgedAt) {
		this.documentId = documentId;
		this.staffId = staffId;
		this.versionNo = versionNo;
		this.acknowledgedAt = acknowledgedAt;
	}

	public UUID getDocumentId() {
		return documentId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public int getVersionNo() {
		return versionNo;
	}

	public Instant getAcknowledgedAt() {
		return acknowledgedAt;
	}

}
