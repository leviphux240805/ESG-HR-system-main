package com.preschool.common.file;

import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Metadata một file trên S3/MinIO (bảng {@code files}); nội dung file không nằm trong DB. */
@Entity
@Table(name = "files")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class StoredFile extends OrganizationEntity {

	public enum Status {
		/** Đã cấp link upload, chưa xác nhận object trên storage. */
		PENDING,
		/** Đã kiểm tra object đúng kích thước/loại khai báo; được phép tải. */
		READY
	}

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "storage_key", nullable = false)
	private String storageKey;

	@Column(name = "original_name", nullable = false)
	private String originalName;

	@Column(name = "mime_type", nullable = false)
	private String mimeType;

	@Column(name = "size_bytes", nullable = false)
	private long sizeBytes;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status = Status.PENDING;

	@Column(name = "uploaded_by", nullable = false)
	private UUID uploadedBy;

	protected StoredFile() {
	}

	public StoredFile(UUID schoolId, String storageKey, String originalName, String mimeType, long sizeBytes,
			UUID uploadedBy) {
		this.schoolId = schoolId;
		this.storageKey = storageKey;
		this.originalName = originalName;
		this.mimeType = mimeType;
		this.sizeBytes = sizeBytes;
		this.uploadedBy = uploadedBy;
	}

	public void markReady() {
		this.status = Status.READY;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public String getStorageKey() {
		return storageKey;
	}

	public String getOriginalName() {
		return originalName;
	}

	public String getMimeType() {
		return mimeType;
	}

	public long getSizeBytes() {
		return sizeBytes;
	}

	public Status getStatus() {
		return status;
	}

	public UUID getUploadedBy() {
		return uploadedBy;
	}

}
