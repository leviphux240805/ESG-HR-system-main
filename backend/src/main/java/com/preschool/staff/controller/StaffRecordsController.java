package com.preschool.staff.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.staff.dto.StaffRecordDtos.CertificateDto;
import com.preschool.staff.dto.StaffRecordDtos.CertificateRequest;
import com.preschool.staff.dto.StaffRecordDtos.ContractDto;
import com.preschool.staff.dto.StaffRecordDtos.ContractRequest;
import com.preschool.staff.dto.StaffRecordDtos.DependentDto;
import com.preschool.staff.dto.StaffRecordDtos.DependentRequest;
import com.preschool.staff.dto.StaffRecordDtos.StaffDocumentDto;
import com.preschool.staff.dto.StaffRecordDtos.StaffDocumentRequest;
import com.preschool.staff.dto.StaffRecordDtos.TrainingDto;
import com.preschool.staff.dto.StaffRecordDtos.TrainingRequest;
import com.preschool.staff.service.StaffRecordsService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Mục con của hồ sơ nhân viên: hợp đồng, người phụ thuộc, chứng chỉ, đào tạo, giấy tờ, file. */
@RestController
@RequestMapping("/api/v1/staff/{staffId}")
@Tag(name = "Nhân sự")
public class StaffRecordsController {

	private final StaffRecordsService records;

	public StaffRecordsController(StaffRecordsService records) {
		this.records = records;
	}

	// ---- hợp đồng

	@GetMapping("/contracts")
	public List<ContractDto> contracts(@PathVariable UUID staffId) {
		return records.contracts(staffId);
	}

	@PostMapping("/contracts")
	@ResponseStatus(HttpStatus.CREATED)
	public ContractDto createContract(@PathVariable UUID staffId, @Valid @RequestBody ContractRequest request) {
		return records.createContract(staffId, request);
	}

	@PutMapping("/contracts/{contractId}")
	public ContractDto updateContract(@PathVariable UUID staffId, @PathVariable UUID contractId,
			@Valid @RequestBody ContractRequest request) {
		return records.updateContract(staffId, contractId, request);
	}

	@DeleteMapping("/contracts/{contractId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteContract(@PathVariable UUID staffId, @PathVariable UUID contractId) {
		records.deleteContract(staffId, contractId);
	}

	// ---- người phụ thuộc

	@GetMapping("/dependents")
	public List<DependentDto> dependents(@PathVariable UUID staffId) {
		return records.dependents(staffId);
	}

	@PostMapping("/dependents")
	@ResponseStatus(HttpStatus.CREATED)
	public DependentDto createDependent(@PathVariable UUID staffId, @Valid @RequestBody DependentRequest request) {
		return records.createDependent(staffId, request);
	}

	@PutMapping("/dependents/{id}")
	public DependentDto updateDependent(@PathVariable UUID staffId, @PathVariable UUID id,
			@Valid @RequestBody DependentRequest request) {
		return records.updateDependent(staffId, id, request);
	}

	@DeleteMapping("/dependents/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteDependent(@PathVariable UUID staffId, @PathVariable UUID id) {
		records.deleteDependent(staffId, id);
	}

	// ---- chứng chỉ

	@GetMapping("/certificates")
	public List<CertificateDto> certificates(@PathVariable UUID staffId) {
		return records.certificates(staffId);
	}

	@PostMapping("/certificates")
	@ResponseStatus(HttpStatus.CREATED)
	public CertificateDto createCertificate(@PathVariable UUID staffId,
			@Valid @RequestBody CertificateRequest request) {
		return records.createCertificate(staffId, request);
	}

	@PutMapping("/certificates/{id}")
	public CertificateDto updateCertificate(@PathVariable UUID staffId, @PathVariable UUID id,
			@Valid @RequestBody CertificateRequest request) {
		return records.updateCertificate(staffId, id, request);
	}

	@DeleteMapping("/certificates/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteCertificate(@PathVariable UUID staffId, @PathVariable UUID id) {
		records.deleteCertificate(staffId, id);
	}

	// ---- đào tạo

	@GetMapping("/trainings")
	public List<TrainingDto> trainings(@PathVariable UUID staffId) {
		return records.trainings(staffId);
	}

	@PostMapping("/trainings")
	@ResponseStatus(HttpStatus.CREATED)
	public TrainingDto createTraining(@PathVariable UUID staffId, @Valid @RequestBody TrainingRequest request) {
		return records.createTraining(staffId, request);
	}

	@PutMapping("/trainings/{id}")
	public TrainingDto updateTraining(@PathVariable UUID staffId, @PathVariable UUID id,
			@Valid @RequestBody TrainingRequest request) {
		return records.updateTraining(staffId, id, request);
	}

	@DeleteMapping("/trainings/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteTraining(@PathVariable UUID staffId, @PathVariable UUID id) {
		records.deleteTraining(staffId, id);
	}

	// ---- giấy tờ

	@GetMapping("/documents")
	@Operation(summary = "Giấy tờ của nhân viên (mọi phiên bản, bản hiện hành có current = true)")
	public List<StaffDocumentDto> documents(@PathVariable UUID staffId) {
		return records.documents(staffId);
	}

	@PostMapping("/documents")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Tải lên giấy tờ (phiên bản mới, không ghi đè bản cũ)")
	public StaffDocumentDto addDocument(@PathVariable UUID staffId,
			@Valid @RequestBody StaffDocumentRequest request) {
		return records.addDocument(staffId, request);
	}

	@DeleteMapping("/documents/{documentId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteDocument(@PathVariable UUID staffId, @PathVariable UUID documentId) {
		records.deleteDocument(staffId, documentId);
	}

	@GetMapping("/files/{fileId}/download-url")
	@Operation(summary = "Link tải/xem file thuộc hồ sơ", description = "inline=true để xem trước PDF/ảnh trong trình duyệt.")
	public DownloadUrlResponse fileUrl(@PathVariable UUID staffId, @PathVariable UUID fileId,
			@RequestParam(defaultValue = "false") boolean inline) {
		return records.fileUrl(staffId, fileId, inline);
	}

}
