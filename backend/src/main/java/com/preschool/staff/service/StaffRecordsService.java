package com.preschool.staff.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.document.entity.DocumentType;
import com.preschool.document.entity.StaffDocument;
import com.preschool.document.repository.DocumentTypeRepository;
import com.preschool.document.repository.StaffDocumentRepository;
import com.preschool.staff.dto.StaffRecordDtos.CertificateDto;
import com.preschool.staff.dto.StaffRecordDtos.CertificateRequest;
import com.preschool.staff.dto.StaffRecordDtos.ContractDto;
import com.preschool.staff.dto.StaffRecordDtos.ContractRequest;
import com.preschool.staff.dto.StaffRecordDtos.DependentDto;
import com.preschool.staff.dto.StaffRecordDtos.DependentRequest;
import com.preschool.staff.dto.StaffRecordDtos.DocumentTypeDto;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;
import com.preschool.staff.dto.StaffRecordDtos.StaffDocumentDto;
import com.preschool.staff.dto.StaffRecordDtos.StaffDocumentRequest;
import com.preschool.staff.dto.StaffRecordDtos.TrainingDto;
import com.preschool.staff.dto.StaffRecordDtos.TrainingRequest;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffCertificate;
import com.preschool.staff.entity.StaffContract;
import com.preschool.staff.entity.StaffDependent;
import com.preschool.staff.entity.StaffTraining;
import com.preschool.staff.repository.StaffCertificateRepository;
import com.preschool.staff.repository.StaffContractRepository;
import com.preschool.staff.repository.StaffDependentRepository;
import com.preschool.staff.repository.StaffRepository;
import com.preschool.staff.repository.StaffTrainingRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Các mục con của hồ sơ nhân viên. Luôn nạp hồ sơ trước (đã lọc theo cơ sở → 404 nếu ngoài phạm vi) rồi mới kiểm
 * tra quyền xem/sửa trên hồ sơ đó; mục con phải thuộc đúng hồ sơ. Thay đổi ghi audit theo id nhân viên
 * ({@code staff.contract}, {@code staff.document}…) để tab Lịch sử lấy được.
 */
@Service
public class StaffRecordsService {

	private final StaffService staffService;

	private final StaffAccess access;

	private final StaffRepository staffRepo;

	private final StaffContractRepository contracts;

	private final StaffDependentRepository dependents;

	private final StaffCertificateRepository certificates;

	private final StaffTrainingRepository trainings;

	private final StaffDocumentRepository documents;

	private final DocumentTypeRepository documentTypes;

	private final FileService fileService;

	private final AuditService audit;

	public StaffRecordsService(StaffService staffService, StaffAccess access, StaffRepository staffRepo,
			StaffContractRepository contracts, StaffDependentRepository dependents,
			StaffCertificateRepository certificates, StaffTrainingRepository trainings,
			StaffDocumentRepository documents, DocumentTypeRepository documentTypes, FileService fileService,
			AuditService audit) {
		this.staffService = staffService;
		this.access = access;
		this.staffRepo = staffRepo;
		this.contracts = contracts;
		this.dependents = dependents;
		this.certificates = certificates;
		this.trainings = trainings;
		this.documents = documents;
		this.documentTypes = documentTypes;
		this.fileService = fileService;
		this.audit = audit;
	}

	// ------------------------------------------------------------ hợp đồng

	@Transactional(readOnly = true)
	public List<ContractDto> contracts(UUID staffId) {
		forView(staffId);
		List<StaffContract> list = contracts.findByStaffIdOrderByStartDateDesc(staffId);
		Map<UUID, StoredFile> files = files(list.stream().map(StaffContract::getFileId).toList());
		return list.stream().map(c -> toDto(c, files)).toList();
	}

	@Transactional
	public ContractDto createContract(UUID staffId, ContractRequest request) {
		Staff staff = forEdit(staffId);
		StaffContract contract = new StaffContract(staff.getId());
		applyContract(contract, request);
		contracts.save(contract);
		ContractDto dto = toDto(contract, files(List.of(nullSafe(contract.getFileId()))));
		audit.record("staff.contract", staffId, Action.CREATE, null, dto);
		return dto;
	}

	@Transactional
	public ContractDto updateContract(UUID staffId, UUID contractId, ContractRequest request) {
		forEdit(staffId);
		StaffContract contract = owned(contracts.findById(contractId), StaffContract::getStaffId, staffId);
		ContractDto before = toDto(contract, files(List.of(nullSafe(contract.getFileId()))));
		applyContract(contract, request);
		ContractDto after = toDto(contract, files(List.of(nullSafe(contract.getFileId()))));
		audit.record("staff.contract", staffId, Action.UPDATE, before, after);
		return after;
	}

	@Transactional
	public void deleteContract(UUID staffId, UUID contractId) {
		forEdit(staffId);
		StaffContract contract = owned(contracts.findById(contractId), StaffContract::getStaffId, staffId);
		audit.record("staff.contract", staffId, Action.DELETE, toDto(contract, Map.of()), null);
		contracts.delete(contract);
	}

	private void applyContract(StaffContract contract, ContractRequest request) {
		requireDateOrder(request.startDate(), request.endDate(), "endDate", "ngày kết thúc phải sau ngày bắt đầu");
		contract.setContractType(request.contractType());
		contract.setContractNo(blankToNull(request.contractNo()));
		contract.setSignedOn(request.signedOn());
		contract.setStartDate(request.startDate());
		contract.setEndDate(request.endDate());
		contract.setFileId(attach(request.fileId(), contract.getFileId()));
		contract.setNote(blankToNull(request.note()));
	}

	private static ContractDto toDto(StaffContract c, Map<UUID, StoredFile> files) {
		return new ContractDto(c.getId(), c.getContractType(), c.getContractNo(), c.getSignedOn(), c.getStartDate(),
				c.getEndDate(), ref(files.get(c.getFileId())), c.getNote());
	}

	// ------------------------------------------------------------ người phụ thuộc

	@Transactional(readOnly = true)
	public List<DependentDto> dependents(UUID staffId) {
		forView(staffId);
		return dependents.findByStaffIdOrderByFromMonthAsc(staffId).stream().map(StaffRecordsService::toDto).toList();
	}

	@Transactional
	public DependentDto createDependent(UUID staffId, DependentRequest request) {
		forEdit(staffId);
		StaffDependent dependent = new StaffDependent(staffId);
		applyDependent(dependent, request);
		dependents.save(dependent);
		DependentDto dto = toDto(dependent);
		audit.record("staff.dependent", staffId, Action.CREATE, null, dto);
		return dto;
	}

	@Transactional
	public DependentDto updateDependent(UUID staffId, UUID id, DependentRequest request) {
		forEdit(staffId);
		StaffDependent dependent = owned(dependents.findById(id), StaffDependent::getStaffId, staffId);
		DependentDto before = toDto(dependent);
		applyDependent(dependent, request);
		DependentDto after = toDto(dependent);
		audit.record("staff.dependent", staffId, Action.UPDATE, before, after);
		return after;
	}

	@Transactional
	public void deleteDependent(UUID staffId, UUID id) {
		forEdit(staffId);
		StaffDependent dependent = owned(dependents.findById(id), StaffDependent::getStaffId, staffId);
		audit.record("staff.dependent", staffId, Action.DELETE, toDto(dependent), null);
		dependents.delete(dependent);
	}

	private static void applyDependent(StaffDependent d, DependentRequest r) {
		requireDateOrder(r.fromMonth(), r.toMonth(), "toMonth", "tháng kết thúc phải sau tháng bắt đầu");
		d.setFullName(r.fullName().trim());
		d.setRelationship(r.relationship().trim());
		d.setDob(r.dob());
		d.setIdNumber(blankToNull(r.idNumber()));
		d.setFromMonth(r.fromMonth().withDayOfMonth(1));
		d.setToMonth(r.toMonth() == null ? null : r.toMonth().withDayOfMonth(1));
	}

	private static DependentDto toDto(StaffDependent d) {
		return new DependentDto(d.getId(), d.getFullName(), d.getRelationship(), d.getDob(), d.getIdNumber(),
				d.getFromMonth(), d.getToMonth());
	}

	// ------------------------------------------------------------ chứng chỉ

	@Transactional(readOnly = true)
	public List<CertificateDto> certificates(UUID staffId) {
		forView(staffId);
		List<StaffCertificate> list = certificates.findByStaffIdOrderByIssueDateDesc(staffId);
		Map<UUID, StoredFile> files = files(list.stream().map(StaffCertificate::getFileId).toList());
		return list.stream().map(c -> toDto(c, files)).toList();
	}

	@Transactional
	public CertificateDto createCertificate(UUID staffId, CertificateRequest request) {
		forEdit(staffId);
		StaffCertificate certificate = new StaffCertificate(staffId);
		applyCertificate(certificate, request);
		certificates.save(certificate);
		CertificateDto dto = toDto(certificate, files(List.of(nullSafe(certificate.getFileId()))));
		audit.record("staff.certificate", staffId, Action.CREATE, null, dto);
		return dto;
	}

	@Transactional
	public CertificateDto updateCertificate(UUID staffId, UUID id, CertificateRequest request) {
		forEdit(staffId);
		StaffCertificate certificate = owned(certificates.findById(id), StaffCertificate::getStaffId, staffId);
		CertificateDto before = toDto(certificate, Map.of());
		applyCertificate(certificate, request);
		CertificateDto after = toDto(certificate, files(List.of(nullSafe(certificate.getFileId()))));
		audit.record("staff.certificate", staffId, Action.UPDATE, before, after);
		return after;
	}

	@Transactional
	public void deleteCertificate(UUID staffId, UUID id) {
		forEdit(staffId);
		StaffCertificate certificate = owned(certificates.findById(id), StaffCertificate::getStaffId, staffId);
		audit.record("staff.certificate", staffId, Action.DELETE, toDto(certificate, Map.of()), null);
		certificates.delete(certificate);
	}

	private void applyCertificate(StaffCertificate c, CertificateRequest r) {
		requireDateOrder(r.issueDate(), r.expiryDate(), "expiryDate", "ngày hết hạn phải sau ngày cấp");
		c.setName(r.name().trim());
		c.setIssuedBy(blankToNull(r.issuedBy()));
		c.setIssueDate(r.issueDate());
		c.setExpiryDate(r.expiryDate());
		c.setFileId(attach(r.fileId(), c.getFileId()));
	}

	private static CertificateDto toDto(StaffCertificate c, Map<UUID, StoredFile> files) {
		return new CertificateDto(c.getId(), c.getName(), c.getIssuedBy(), c.getIssueDate(), c.getExpiryDate(),
				ref(files.get(c.getFileId())));
	}

	// ------------------------------------------------------------ đào tạo

	@Transactional(readOnly = true)
	public List<TrainingDto> trainings(UUID staffId) {
		forView(staffId);
		List<StaffTraining> list = trainings.findByStaffIdOrderByStartDateDesc(staffId);
		Map<UUID, StoredFile> files = files(list.stream().map(StaffTraining::getFileId).toList());
		return list.stream().map(t -> toDto(t, files)).toList();
	}

	@Transactional
	public TrainingDto createTraining(UUID staffId, TrainingRequest request) {
		forEdit(staffId);
		StaffTraining training = new StaffTraining(staffId);
		applyTraining(training, request);
		trainings.save(training);
		TrainingDto dto = toDto(training, files(List.of(nullSafe(training.getFileId()))));
		audit.record("staff.training", staffId, Action.CREATE, null, dto);
		return dto;
	}

	@Transactional
	public TrainingDto updateTraining(UUID staffId, UUID id, TrainingRequest request) {
		forEdit(staffId);
		StaffTraining training = owned(trainings.findById(id), StaffTraining::getStaffId, staffId);
		TrainingDto before = toDto(training, Map.of());
		applyTraining(training, request);
		TrainingDto after = toDto(training, files(List.of(nullSafe(training.getFileId()))));
		audit.record("staff.training", staffId, Action.UPDATE, before, after);
		return after;
	}

	@Transactional
	public void deleteTraining(UUID staffId, UUID id) {
		forEdit(staffId);
		StaffTraining training = owned(trainings.findById(id), StaffTraining::getStaffId, staffId);
		audit.record("staff.training", staffId, Action.DELETE, toDto(training, Map.of()), null);
		trainings.delete(training);
	}

	private void applyTraining(StaffTraining t, TrainingRequest r) {
		requireDateOrder(r.startDate(), r.endDate(), "endDate", "ngày kết thúc phải sau ngày bắt đầu");
		t.setCourseName(r.courseName().trim());
		t.setProvider(blankToNull(r.provider()));
		t.setStartDate(r.startDate());
		t.setEndDate(r.endDate());
		t.setResult(blankToNull(r.result()));
		t.setFileId(attach(r.fileId(), t.getFileId()));
	}

	private static TrainingDto toDto(StaffTraining t, Map<UUID, StoredFile> files) {
		return new TrainingDto(t.getId(), t.getCourseName(), t.getProvider(), t.getStartDate(), t.getEndDate(),
				t.getResult(), ref(files.get(t.getFileId())));
	}

	// ------------------------------------------------------------ giấy tờ (nhiều phiên bản)

	@Transactional(readOnly = true)
	public List<DocumentTypeDto> documentTypes(DocumentType.Scope scope) {
		return documentTypes.findByScopeAndActiveTrueOrderBySortOrder(scope).stream()
			.map(StaffRecordsService::toDto)
			.toList();
	}

	/** Mọi phiên bản, mới nhất trước; phiên bản mới nhất của mỗi loại có `current = true`. */
	@Transactional(readOnly = true)
	public List<StaffDocumentDto> documents(UUID staffId) {
		forView(staffId);
		List<StaffDocument> list = documents.findByStaffIdOrderByCreatedAtDesc(staffId);
		Map<UUID, DocumentType> types = documentTypes.findAll().stream()
			.collect(Collectors.toMap(DocumentType::getId, Function.identity()));
		Map<UUID, StoredFile> files = files(list.stream().map(StaffDocument::getFileId).toList());
		Set<UUID> seenTypes = new HashSet<>();
		List<StaffDocumentDto> result = new ArrayList<>();
		for (StaffDocument d : list) {
			boolean current = seenTypes.add(d.getDocumentTypeId());
			result.add(new StaffDocumentDto(d.getId(), toDto(types.get(d.getDocumentTypeId())),
					ref(files.get(d.getFileId())), d.getIssuedDate(), d.getExpiryDate(), d.getNote(), d.getCreatedAt(),
					current));
		}
		return result;
	}

	/** Tải lên phiên bản mới (không ghi đè bản cũ). */
	@Transactional
	public StaffDocumentDto addDocument(UUID staffId, StaffDocumentRequest request) {
		forEdit(staffId);
		DocumentType type = documentTypes.findById(request.documentTypeId())
			.filter(t -> t.getScope() == DocumentType.Scope.STAFF && t.isActive())
			.orElseThrow(() -> ApiException.badRequest("DOCUMENT_TYPE_INVALID", "Loại giấy tờ không hợp lệ."));
		requireDateOrder(request.issuedDate(), request.expiryDate(), "expiryDate", "ngày hết hạn phải sau ngày cấp");
		StoredFile file = fileService.requireAttachable(request.fileId());
		StaffDocument document = documents.saveAndFlush(new StaffDocument(staffId, type.getId(), file.getId(),
				request.issuedDate(), type.isHasExpiry() ? request.expiryDate() : null, blankToNull(request.note())));
		StaffDocumentDto dto = new StaffDocumentDto(document.getId(), toDto(type), ref(file), document.getIssuedDate(),
				document.getExpiryDate(), document.getNote(), document.getCreatedAt(), true);
		audit.record("staff.document", staffId, Action.CREATE, null, dto);
		return dto;
	}

	@Transactional
	public void deleteDocument(UUID staffId, UUID documentId) {
		forEdit(staffId);
		StaffDocument document = owned(documents.findById(documentId), StaffDocument::getStaffId, staffId);
		audit.record("staff.document", staffId, Action.DELETE,
				Map.of("documentTypeId", document.getDocumentTypeId(), "fileId", document.getFileId()), null);
		documents.delete(document);
	}

	// ------------------------------------------------------------ file của hồ sơ

	/** Link tải/xem file thuộc hồ sơ (người xem được hồ sơ thì xem được file của hồ sơ). */
	@Transactional(readOnly = true)
	public DownloadUrlResponse fileUrl(UUID staffId, UUID fileId, boolean inline) {
		forView(staffId);
		if (!staffRepo.fileBelongsToStaff(staffId, fileId)) {
			throw ApiException.notFound("Không tìm thấy file.");
		}
		StoredFile file = fileService.findForModule(List.of(fileId)).get(fileId);
		if (file == null) {
			throw ApiException.notFound("Không tìm thấy file.");
		}
		return fileService.presignDownload(file, inline);
	}

	// ------------------------------------------------------------ hỗ trợ

	Staff forView(UUID staffId) {
		Staff staff = staffService.find(staffId);
		access.requireView(staff);
		return staff;
	}

	Staff forEdit(UUID staffId) {
		Staff staff = staffService.find(staffId);
		access.requireEdit(staff);
		return staff;
	}

	/** Giữ file cũ nếu không đổi; file mới phải hợp lệ để gắn. */
	private UUID attach(UUID requested, UUID current) {
		if (requested == null || requested.equals(current)) {
			return requested;
		}
		return fileService.requireAttachable(requested).getId();
	}

	private Map<UUID, StoredFile> files(List<UUID> ids) {
		return fileService.findForModule(ids.stream().filter(Objects::nonNull).distinct().toList());
	}

	private static <T> T owned(java.util.Optional<T> record, Function<T, UUID> staffIdOf, UUID staffId) {
		return record.filter(r -> staffIdOf.apply(r).equals(staffId))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy bản ghi."));
	}

	private static UUID nullSafe(UUID id) {
		return id == null ? new UUID(0, 0) : id;
	}

	static FileRef ref(StoredFile file) {
		return file == null ? null
				: new FileRef(file.getId(), file.getOriginalName(), file.getMimeType(), file.getSizeBytes());
	}

	private static DocumentTypeDto toDto(DocumentType t) {
		return new DocumentTypeDto(t.getId(), t.getCode(), t.getName(), t.getCategory(), t.isHasExpiry());
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	private static void requireDateOrder(java.time.LocalDate from, java.time.LocalDate to, String field,
			String message) {
		if (from != null && to != null && to.isBefore(from)) {
			throw ApiException.badRequest("VALIDATION_FAILED", "Dữ liệu không hợp lệ.")
				.withFieldErrors(List.of(Map.of("field", field, "message", message)));
		}
	}

}
