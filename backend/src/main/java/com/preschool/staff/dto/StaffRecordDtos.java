package com.preschool.staff.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.document.entity.DocumentType;
import com.preschool.staff.entity.StaffEnums.ContractType;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTO các mục con của hồ sơ: hợp đồng, người phụ thuộc, chứng chỉ, đào tạo, giấy tờ. */
public final class StaffRecordDtos {

	private StaffRecordDtos() {
	}

	/** File đính kèm (metadata); tải qua /staff/{id}/files/{fileId}/download-url. */
	public record FileRef(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String originalName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String mimeType,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
	}

	// ---- hợp đồng

	public record ContractRequest(@NotNull ContractType contractType, @Size(max = 50) String contractNo,
			LocalDate signedOn, @NotNull LocalDate startDate, LocalDate endDate, UUID fileId,
			@Size(max = 500) String note) {
	}

	public record ContractDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ContractType contractType,
			String contractNo, LocalDate signedOn,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate startDate,
			LocalDate endDate, FileRef file, String note) {
	}

	// ---- người phụ thuộc

	public record DependentRequest(@NotBlank @Size(max = 200) String fullName,
			@NotBlank @Size(max = 50) String relationship, LocalDate dob, @Size(max = 20) String idNumber,
			@Schema(description = "Tháng bắt đầu giảm trừ (ngày đầu tháng)") @NotNull LocalDate fromMonth,
			LocalDate toMonth) {
	}

	public record DependentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String relationship,
			LocalDate dob, String idNumber,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromMonth,
			LocalDate toMonth) {
	}

	// ---- chứng chỉ

	public record CertificateRequest(@NotBlank @Size(max = 200) String name, @Size(max = 200) String issuedBy,
			LocalDate issueDate, LocalDate expiryDate, UUID fileId) {
	}

	public record CertificateDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			String issuedBy, LocalDate issueDate, LocalDate expiryDate, FileRef file) {
	}

	// ---- đào tạo

	public record TrainingRequest(@NotBlank @Size(max = 200) String courseName, @Size(max = 200) String provider,
			LocalDate startDate, LocalDate endDate, @Size(max = 200) String result, UUID fileId) {
	}

	public record TrainingDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String courseName,
			String provider, LocalDate startDate, LocalDate endDate, String result, FileRef file) {
	}

	// ---- giấy tờ

	public record DocumentTypeDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) DocumentType.Category category,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hasExpiry) {
	}

	public record StaffDocumentRequest(@NotNull UUID documentTypeId, @NotNull UUID fileId, LocalDate issuedDate,
			LocalDate expiryDate, @Size(max = 500) String note) {
	}

	/** Một phiên bản giấy tờ; `current` = bản mới nhất của loại đó. */
	public record StaffDocumentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) DocumentTypeDto type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) FileRef file,
			LocalDate issuedDate, LocalDate expiryDate, String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant uploadedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean current) {
	}

}
