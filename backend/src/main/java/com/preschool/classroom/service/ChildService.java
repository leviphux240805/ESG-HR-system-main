package com.preschool.classroom.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.classroom.dto.ChildDtos.ChildDetail;
import com.preschool.classroom.dto.ChildDtos.ChildDocumentDto;
import com.preschool.classroom.dto.ChildDtos.ChildDocumentRequest;
import com.preschool.classroom.dto.ChildDtos.ChildItem;
import com.preschool.classroom.dto.ChildDtos.ChildProfileRequest;
import com.preschool.classroom.dto.ChildDtos.ChildQuery;
import com.preschool.classroom.dto.ChildDtos.ChildStatusRequest;
import com.preschool.classroom.dto.ChildDtos.CreateChildRequest;
import com.preschool.classroom.dto.ChildDtos.EnrollmentDto;
import com.preschool.classroom.dto.ChildDtos.GuardianDto;
import com.preschool.classroom.dto.ChildDtos.GuardianMatch;
import com.preschool.classroom.dto.ChildDtos.GuardianRequest;
import com.preschool.classroom.dto.ChildDtos.TransferRequest;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ChildDocument;
import com.preschool.classroom.entity.ChildGuardian;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.Guardian;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.ChildDocumentRepository;
import com.preschool.classroom.repository.ChildGuardianRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.classroom.repository.GuardianRepository;
import com.preschool.classroom.repository.SchoolClassRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.web.PageResponse;
import com.preschool.document.entity.DocumentType;
import com.preschool.document.repository.DocumentTypeRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffRecordDtos.DocumentTypeDto;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hồ sơ trẻ: danh sách, nhập học, sửa hồ sơ, đổi trạng thái, chuyển lớp, phụ huynh và người đón, giấy tờ.
 * TODO(assumption): giáo viên chỉ xem hồ sơ trẻ trong lớp mình, không sửa.
 */
@Service
public class ChildService {

	private static final Set<String> SORTABLE = Set.of("fullName", "childCode", "dob", "enrolledAt");

	private final ChildRepository children;

	private final ClassEnrollmentRepository enrollments;

	private final SchoolClassRepository classes;

	private final GuardianRepository guardians;

	private final ChildGuardianRepository links;

	private final ChildDocumentRepository documents;

	private final DocumentTypeRepository documentTypes;

	private final ClassroomService classroom;

	private final ClassroomAccess access;

	private final FileService fileService;

	private final AuditService audit;

	private final Clock clock;

	public ChildService(ChildRepository children, ClassEnrollmentRepository enrollments, SchoolClassRepository classes,
			GuardianRepository guardians, ChildGuardianRepository links, ChildDocumentRepository documents,
			DocumentTypeRepository documentTypes, ClassroomService classroom, ClassroomAccess access,
			FileService fileService, AuditService audit, Clock clock) {
		this.children = children;
		this.enrollments = enrollments;
		this.classes = classes;
		this.guardians = guardians;
		this.links = links;
		this.documents = documents;
		this.documentTypes = documentTypes;
		this.classroom = classroom;
		this.access = access;
		this.fileService = fileService;
		this.audit = audit;
		this.clock = clock;
	}

	// ------------------------------------------------------------ đọc

	@Transactional(readOnly = true)
	public PageResponse<ChildItem> list(ChildQuery filter, Pageable pageable) {
		access.requireViewAny();
		Page<Child> page = children.findAll(specOf(filter), sanitize(pageable));
		return new PageResponse<>(toItems(page.getContent()), page.getNumber(), page.getSize(),
				page.getTotalElements(), page.getTotalPages());
	}

	@Transactional(readOnly = true)
	public ChildDetail detail(UUID id) {
		Child child = findVisible(id);
		List<ClassEnrollment> history = enrollments.findByChildIdOrderByFromDateDesc(id);
		Map<UUID, String> classNames = classNames(history.stream().map(ClassEnrollment::getClassId).toList());
		List<ChildDocument> docs = documents.findByChildIdOrderByCreatedAtDesc(id);
		Map<UUID, DocumentType> types = documentTypes
			.findAllById(docs.stream().map(ChildDocument::getDocumentTypeId).collect(Collectors.toSet()))
			.stream()
			.collect(Collectors.toMap(DocumentType::getId, Function.identity()));
		List<UUID> fileIds = new ArrayList<>(docs.stream().map(ChildDocument::getFileId).toList());
		if (child.getPhotoFileId() != null) {
			fileIds.add(child.getPhotoFileId());
		}
		Map<UUID, StoredFile> files = fileService.findForModule(fileIds.stream().distinct().toList());
		return new ChildDetail(toItems(List.of(child)).getFirst(), child.getPersonalId(),
				child.getHealthInsuranceNo(), child.getProvinceCode(), child.getWardCode(), child.getAddressDetail(),
				child.getHealthNote(), ref(files.get(child.getPhotoFileId())), child.getEnrolledAt(),
				child.getLeftAt(), child.getLeftReason(), guardianDtos(id),
				history.stream()
					.map(e -> new EnrollmentDto(e.getId(), e.getClassId(), classNames.getOrDefault(e.getClassId(), ""),
							e.getFromDate(), e.getToDate(), e.getNote()))
					.toList(),
				docs.stream()
					.filter(d -> files.containsKey(d.getFileId()))
					.map(d -> toDto(d, types.get(d.getDocumentTypeId()), files.get(d.getFileId())))
					.toList(),
				access.canManage(child.getSchoolId()));
	}

	/** Phụ huynh đã có trong cơ sở đang chọn theo số điện thoại (gắn cho anh chị em, không nhập lại). */
	@Transactional(readOnly = true)
	public List<GuardianMatch> searchGuardians(String phone) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		String digits = phone == null ? "" : phone.replaceAll("\\D", "");
		if (digits.length() < 10) {
			return List.of();
		}
		List<Guardian> found = guardians.findBySchoolIdAndPhone(schoolId, digits);
		if (found.isEmpty()) {
			return List.of();
		}
		Set<UUID> ids = found.stream().map(Guardian::getId).collect(Collectors.toSet());
		List<ChildGuardian> childLinks = links.findByGuardianIdIn(ids);
		Map<UUID, String> names = children.findAllById(childLinks.stream().map(ChildGuardian::getChildId).toList())
			.stream()
			.collect(Collectors.toMap(Child::getId, Child::getFullName));
		return found.stream()
			.map(g -> new GuardianMatch(g.getId(), g.getFullName(), g.getPhone(),
					childLinks.stream()
						.filter(l -> l.getGuardianId().equals(g.getId()) && names.containsKey(l.getChildId()))
						.map(l -> names.get(l.getChildId()))
						.sorted()
						.toList()))
			.toList();
	}

	// ------------------------------------------------------------ ghi hồ sơ

	@Transactional
	public ChildDetail create(CreateChildRequest request) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		ChildProfileRequest profile = request.profile();
		requireUniquePersonalId(profile.personalId(), null);
		if (!request.enrolledAt().isAfter(profile.dob())) {
			throw ApiException.badRequest("INVALID_DATES", "Ngày nhập học phải sau ngày sinh.");
		}
		SchoolClass target = request.classId() == null ? null : requireTargetClass(request.classId(), schoolId);
		List<GuardianRequest> guardianRequests = request.guardians() == null ? List.of() : request.guardians();
		if (guardianRequests.stream().filter(GuardianRequest::isPrimary).count() > 1) {
			throw ApiException.badRequest("MULTIPLE_PRIMARY", "Chỉ chọn một người liên hệ chính.");
		}

		Child child = new Child(schoolId, request.enrolledAt());
		applyProfile(child, profile);
		child = children.saveAndFlush(child);
		if (target != null) {
			requireSeat(target);
			enrollments.save(new ClassEnrollment(schoolId, child.getId(), target.getId(), request.enrolledAt(), null));
		}
		boolean hasPrimary = guardianRequests.stream().anyMatch(GuardianRequest::isPrimary);
		for (int i = 0; i < guardianRequests.size(); i++) {
			GuardianRequest g = guardianRequests.get(i);
			boolean primary = g.isPrimary() || (!hasPrimary && i == 0);
			link(child, g, primary);
		}
		links.flush();
		audit.record("child", child.getId(), Action.CREATE, null,
				Map.of("fullName", child.getFullName(), "classId", target == null ? "" : target.getId()));
		return detail(child.getId());
	}

	@Transactional
	public ChildDetail update(UUID id, ChildProfileRequest profile) {
		Child child = forEdit(id);
		requireUniquePersonalId(profile.personalId(), id);
		Map<String, Object> before = snapshot(child);
		applyProfile(child, profile);
		children.flush();
		audit.record("child", id, Action.UPDATE, before, snapshot(child));
		return detail(id);
	}

	/**
	 * Đổi trạng thái: nghỉ học hoặc hoàn thành chương trình thì đóng lớp đang học từ ngày đó; bảo lưu giữ chỗ trong
	 * lớp nhưng trẻ không có trong danh sách điểm danh và không tính học phí.
	 */
	@Transactional
	public ChildDetail changeStatus(UUID id, ChildStatusRequest request) {
		Child child = forEdit(id);
		LocalDate date = request.date() != null ? request.date() : classroom.today();
		if (date.isBefore(child.getEnrolledAt())) {
			throw ApiException.badRequest("INVALID_DATES", "Ngày hiệu lực phải từ ngày nhập học trở đi.");
		}
		ChildStatus before = child.getStatus();
		child.changeStatus(request.status(), date, blankToNull(request.reason()));
		if (request.status() == ChildStatus.LEFT || request.status() == ChildStatus.COMPLETED) {
			enrollments.findByChildIdAndToDateIsNull(id).ifPresent(e -> e.end(date));
		}
		children.flush();
		audit.record("child.status", id, Action.UPDATE, Map.of("status", before),
				Map.of("status", request.status(), "date", date));
		return detail(id);
	}

	/** Xếp lớp hoặc chuyển lớp: đóng lớp cũ hết ngày trước đó, mở lớp mới từ ngày chọn (giữ lịch sử). */
	@Transactional
	public ChildDetail transfer(UUID id, TransferRequest request) {
		Child child = forEdit(id);
		if (child.getStatus() == ChildStatus.LEFT || child.getStatus() == ChildStatus.COMPLETED) {
			throw ApiException.conflict("CHILD_NOT_STUDYING", "Trẻ đã nghỉ học, không xếp lớp được.");
		}
		SchoolClass target = requireTargetClass(request.classId(), child.getSchoolId());
		LocalDate from = request.fromDate() != null ? request.fromDate() : classroom.today();
		if (from.isBefore(child.getEnrolledAt())) {
			throw ApiException.badRequest("INVALID_DATES", "Ngày vào lớp phải từ ngày nhập học trở đi.");
		}
		ClassEnrollment current = enrollments.findByChildIdAndToDateIsNull(id).orElse(null);
		if (current != null) {
			if (current.getClassId().equals(target.getId())) {
				throw ApiException.conflict("SAME_CLASS", "Trẻ đang học lớp này.");
			}
			if (!from.isAfter(current.getFromDate())) {
				throw ApiException.badRequest("INVALID_DATES", "Ngày chuyển phải sau ngày vào lớp hiện tại.")
					.withFieldErrors(List.of(Map.of("field", "fromDate", "message",
							"Ngày chuyển phải sau ngày vào lớp hiện tại.")));
			}
		}
		requireSeat(target);
		if (current != null) {
			current.end(from.minusDays(1));
			enrollments.saveAndFlush(current);
		}
		enrollments.saveAndFlush(
				new ClassEnrollment(child.getSchoolId(), id, target.getId(), from, blankToNull(request.note())));
		audit.record("child.enrollment", id, Action.UPDATE,
				current == null ? null : Map.of("classId", current.getClassId()),
				Map.of("classId", target.getId(), "fromDate", from));
		return detail(id);
	}

	/** Xóa hồ sơ nhập nhầm (xóa mềm); trẻ thôi học thì dùng đổi trạng thái. */
	@Transactional
	public void delete(UUID id) {
		Child child = forEdit(id);
		enrollments.findByChildIdAndToDateIsNull(id).ifPresent(e -> e.end(classroom.today()));
		audit.record("child", id, Action.DELETE, snapshot(child), null);
		child.softDelete(Instant.now(clock));
	}

	// ------------------------------------------------------------ phụ huynh, người đón

	@Transactional
	public List<GuardianDto> addGuardian(UUID childId, GuardianRequest request) {
		Child child = forEdit(childId);
		if (request.isPrimary()) {
			clearPrimary(childId, null);
		}
		ChildGuardian link = link(child, request, request.isPrimary());
		links.flush();
		audit.record("child.guardian", childId, Action.CREATE, null,
				Map.of("guardianId", link.getGuardianId(), "relationship", link.getRelationship()));
		return guardianDtos(childId);
	}

	@Transactional
	public List<GuardianDto> updateGuardian(UUID childId, UUID linkId, GuardianRequest request) {
		forEdit(childId);
		ChildGuardian link = ownedLink(childId, linkId);
		Guardian guardian = guardians.findById(link.getGuardianId()).orElseThrow();
		String fullName = blankToNull(request.fullName());
		if (fullName == null) {
			throw guardianNameRequired();
		}
		if (request.isPrimary()) {
			clearPrimary(childId, linkId);
		}
		guardian.update(fullName, digitsOrNull(request.phone()), blankToNull(request.email()),
				blankToNull(request.citizenId()), blankToNull(request.job()));
		link.update(request.relationship().trim(), request.isPrimary(), request.pickUp(), blankToNull(request.note()));
		links.flush();
		audit.record("child.guardian", childId, Action.UPDATE, null,
				Map.of("guardianId", link.getGuardianId(), "relationship", link.getRelationship()));
		return guardianDtos(childId);
	}

	/** Bỏ liên kết với trẻ; thông tin phụ huynh giữ lại cho anh chị em. */
	@Transactional
	public List<GuardianDto> removeGuardian(UUID childId, UUID linkId) {
		forEdit(childId);
		ChildGuardian link = ownedLink(childId, linkId);
		audit.record("child.guardian", childId, Action.DELETE, Map.of("guardianId", link.getGuardianId()), null);
		links.delete(link);
		links.flush();
		return guardianDtos(childId);
	}

	private ChildGuardian link(Child child, GuardianRequest request, boolean primary) {
		Guardian guardian;
		if (request.guardianId() != null) {
			guardian = guardians.findById(request.guardianId())
				.filter(g -> g.getSchoolId().equals(child.getSchoolId()))
				.orElseThrow(() -> ApiException.badRequest("INVALID_GUARDIAN", "Phụ huynh không thuộc cơ sở của trẻ."));
			if (links.existsByChildIdAndGuardianId(child.getId(), guardian.getId())) {
				throw ApiException.conflict("GUARDIAN_LINKED", "Người này đã có trong danh sách phụ huynh của trẻ.");
			}
		}
		else {
			String fullName = blankToNull(request.fullName());
			if (fullName == null) {
				throw guardianNameRequired();
			}
			guardian = guardians.save(new Guardian(child.getSchoolId(), fullName, digitsOrNull(request.phone()),
					blankToNull(request.email()), blankToNull(request.citizenId()), blankToNull(request.job())));
		}
		return links.save(new ChildGuardian(child.getSchoolId(), child.getId(), guardian.getId(),
				request.relationship().trim(), primary, request.pickUp(), blankToNull(request.note())));
	}

	/** Bỏ cờ liên hệ chính của người khác trước khi gán (chỉ một người liên hệ chính mỗi trẻ). */
	private void clearPrimary(UUID childId, UUID exceptLinkId) {
		links.findByChildId(childId)
			.stream()
			.filter(l -> l.isPrimaryContact() && !l.getId().equals(exceptLinkId))
			.forEach(ChildGuardian::clearPrimary);
		links.flush();
	}

	private ChildGuardian ownedLink(UUID childId, UUID linkId) {
		return links.findById(linkId)
			.filter(l -> l.getChildId().equals(childId))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy phụ huynh."));
	}

	private List<GuardianDto> guardianDtos(UUID childId) {
		List<ChildGuardian> list = links.findByChildId(childId);
		Map<UUID, Guardian> byId = guardians.findByIdIn(list.stream().map(ChildGuardian::getGuardianId).toList())
			.stream()
			.collect(Collectors.toMap(Guardian::getId, Function.identity()));
		return list.stream()
			.filter(l -> byId.containsKey(l.getGuardianId()))
			.sorted(Comparator.comparing(ChildGuardian::isPrimaryContact).reversed()
				.thenComparing(ChildGuardian::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
			.map(l -> {
				Guardian g = byId.get(l.getGuardianId());
				return new GuardianDto(l.getId(), g.getId(), g.getFullName(), g.getPhone(), g.getEmail(),
						g.getCitizenId(), g.getJob(), l.getRelationship(), l.isPrimaryContact(), l.isCanPickUp(),
						l.getNote());
			})
			.toList();
	}

	private static ApiException guardianNameRequired() {
		return ApiException.badRequest("GUARDIAN_NAME_REQUIRED", "Vui lòng nhập họ tên phụ huynh.")
			.withFieldErrors(List.of(Map.of("field", "fullName", "message", "Vui lòng nhập họ tên phụ huynh.")));
	}

	// ------------------------------------------------------------ giấy tờ

	@Transactional
	public ChildDocumentDto addDocument(UUID childId, ChildDocumentRequest request) {
		Child child = forEdit(childId);
		DocumentType type = documentTypes.findById(request.documentTypeId())
			.filter(t -> t.getScope() == DocumentType.Scope.CHILD && t.isActive())
			.orElseThrow(() -> ApiException.badRequest("DOCUMENT_TYPE_INVALID", "Loại giấy tờ không hợp lệ."));
		if (request.issuedDate() != null && request.expiryDate() != null
				&& request.expiryDate().isBefore(request.issuedDate())) {
			throw ApiException.badRequest("INVALID_DATES", "Ngày hết hạn phải sau ngày cấp.")
				.withFieldErrors(List.of(Map.of("field", "expiryDate", "message", "Ngày hết hạn phải sau ngày cấp.")));
		}
		StoredFile file = fileService.requireAttachable(request.fileId());
		ChildDocument document = documents.saveAndFlush(new ChildDocument(child.getSchoolId(), childId, type.getId(),
				file.getId(), request.issuedDate(), type.isHasExpiry() ? request.expiryDate() : null,
				blankToNull(request.note())));
		ChildDocumentDto dto = toDto(document, type, file);
		audit.record("child.document", childId, Action.CREATE, null,
				Map.of("documentTypeId", type.getId(), "fileId", file.getId()));
		return dto;
	}

	@Transactional
	public void deleteDocument(UUID childId, UUID documentId) {
		forEdit(childId);
		ChildDocument document = documents.findById(documentId)
			.filter(d -> d.getChildId().equals(childId))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy giấy tờ."));
		audit.record("child.document", childId, Action.DELETE,
				Map.of("documentTypeId", document.getDocumentTypeId(), "fileId", document.getFileId()), null);
		documents.delete(document);
	}

	/** Link xem/tải ảnh hoặc giấy tờ của trẻ (ai xem được hồ sơ thì xem được file của hồ sơ). */
	@Transactional(readOnly = true)
	public DownloadUrlResponse fileUrl(UUID childId, UUID fileId, boolean inline) {
		Child child = findVisible(childId);
		boolean belongs = fileId.equals(child.getPhotoFileId()) || documents.findByChildIdOrderByCreatedAtDesc(childId)
			.stream()
			.anyMatch(d -> d.getFileId().equals(fileId));
		StoredFile file = belongs ? fileService.findForModule(List.of(fileId)).get(fileId) : null;
		if (file == null) {
			throw ApiException.notFound("Không tìm thấy file.");
		}
		return fileService.presignDownload(file, inline);
	}

	// ------------------------------------------------------------ hỗ trợ

	/** Trẻ người dùng được xem; ngoài phạm vi trả 404. Giáo viên chỉ thấy trẻ đang học lớp mình. */
	public Child findVisible(UUID id) {
		return children.findById(id)
			.filter(c -> access.canViewAll(c.getSchoolId()) || (access.isTeacherAt(c.getSchoolId())
					&& enrollments.findByChildIdAndToDateIsNull(c.getId())
						.map(e -> access.myClassIds().contains(e.getClassId()))
						.orElse(false)))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy hồ sơ trẻ."));
	}

	private Child forEdit(UUID id) {
		Child child = findVisible(id);
		access.requireManage(child.getSchoolId());
		return child;
	}

	private SchoolClass requireTargetClass(UUID classId, UUID schoolId) {
		return classes.findById(classId)
			.filter(c -> c.getSchoolId().equals(schoolId))
			.orElseThrow(() -> ApiException.badRequest("INVALID_CLASS", "Lớp không thuộc cơ sở của trẻ.")
				.withFieldErrors(List.of(Map.of("field", "classId", "message", "Chọn lớp của cơ sở này."))));
	}

	/** Sĩ số tối đa của lớp (lấy từ khối, sửa được theo lớp). */
	private void requireSeat(SchoolClass target) {
		if (enrollments.countByClassIdAndToDateIsNull(target.getId()) >= target.getCapacity()) {
			throw ApiException.conflict("CLASS_FULL", "Lớp đã đủ sĩ số tối đa (" + target.getCapacity() + " trẻ).");
		}
	}

	private void requireUniquePersonalId(String personalId, UUID exclude) {
		String value = blankToNull(personalId);
		if (value != null && children.personalIdTaken(SchoolScope.require().organizationId(), value, exclude)) {
			throw ApiException.conflict("DUPLICATE_PERSONAL_ID", "Mã định danh đã có trong hệ thống.")
				.withFieldErrors(List.of(Map.of("field", "personalId", "message", "Mã định danh đã có trong hệ thống.")));
		}
	}

	private void applyProfile(Child child, ChildProfileRequest p) {
		UUID photo = p.photoFileId();
		if (photo != null && !photo.equals(child.getPhotoFileId())) {
			fileService.requireAttachable(photo);
		}
		child.setFields(p.fullName().trim(), blankToNull(p.nickname()), p.dob(), p.gender(),
				blankToNull(p.personalId()), blankToNull(p.healthInsuranceNo()), blankToNull(p.provinceCode()),
				blankToNull(p.wardCode()), blankToNull(p.addressDetail()), blankToNull(p.allergyNote()),
				blankToNull(p.healthNote()), photo);
	}

	private static Map<String, Object> snapshot(Child c) {
		Map<String, Object> map = new LinkedHashMap<>();
		map.put("fullName", c.getFullName());
		map.put("dob", c.getDob());
		map.put("gender", c.getGender());
		map.put("personalId", c.getPersonalId());
		map.put("allergyNote", c.getAllergyNote());
		map.put("healthNote", c.getHealthNote());
		map.put("status", c.getStatus());
		return map;
	}

	private Specification<Child> specOf(ChildQuery filter) {
		Set<UUID> viewAllSchools = SchoolScope.require()
			.effectiveSchoolIds()
			.stream()
			.filter(access::canViewAll)
			.collect(Collectors.toSet());
		Set<UUID> myClasses = viewAllSchools.containsAll(SchoolScope.require().effectiveSchoolIds()) ? Set.of()
				: access.myClassIds();
		return (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			List<Predicate> visible = new ArrayList<>();
			if (!viewAllSchools.isEmpty()) {
				visible.add(root.get("schoolId").in(viewAllSchools));
			}
			if (!myClasses.isEmpty()) {
				visible.add(cb.exists(activeEnrollment(root, query, cb, myClasses)));
			}
			predicates.add(visible.isEmpty() ? cb.disjunction() : cb.or(visible.toArray(Predicate[]::new)));
			if (filter.classId() != null) {
				predicates.add(cb.exists(activeEnrollment(root, query, cb, Set.of(filter.classId()))));
			}
			if (filter.status() != null) {
				predicates.add(cb.equal(root.get("status"), filter.status()));
			}
			if (filter.gender() != null) {
				predicates.add(cb.equal(root.get("gender"), filter.gender()));
			}
			if (filter.q() != null && !filter.q().isBlank()) {
				String like = "%" + filter.q().trim().toLowerCase(Locale.ROOT) + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("fullName")), like),
						cb.like(cb.lower(root.get("nickname")), like), cb.like(cb.lower(root.get("childCode")), like)));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static Subquery<UUID> activeEnrollment(Root<Child> root, CriteriaQuery<?> query, CriteriaBuilder cb,
			Collection<UUID> classIds) {
		Subquery<UUID> sub = query.subquery(UUID.class);
		var e = sub.from(ClassEnrollment.class);
		sub.select(e.get("childId"))
			.where(cb.equal(e.get("childId"), root.get("id")), cb.isNull(e.get("toDate")), e.get("classId").in(classIds));
		return sub;
	}

	private static Pageable sanitize(Pageable pageable) {
		for (Sort.Order order : pageable.getSort()) {
			if (!SORTABLE.contains(order.getProperty())) {
				throw ApiException.badRequest("SORT_INVALID", "Không sắp xếp được theo cột này.");
			}
		}
		Sort sort = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by("fullName");
		return PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100), sort.and(Sort.by("id")));
	}

	private List<ChildItem> toItems(List<Child> list) {
		if (list.isEmpty()) {
			return List.of();
		}
		List<UUID> ids = list.stream().map(Child::getId).toList();
		Map<UUID, ClassEnrollment> active = enrollments.findByChildIdInAndToDateIsNull(ids)
			.stream()
			.collect(Collectors.toMap(ClassEnrollment::getChildId, Function.identity()));
		Map<UUID, String> classNames = classNames(active.values().stream().map(ClassEnrollment::getClassId).toList());
		Map<UUID, ChildGuardian> primary = links.findByChildIdIn(ids)
			.stream()
			.filter(ChildGuardian::isPrimaryContact)
			.collect(Collectors.toMap(ChildGuardian::getChildId, Function.identity()));
		Map<UUID, Guardian> guardianById = guardians
			.findByIdIn(primary.values().stream().map(ChildGuardian::getGuardianId).toList())
			.stream()
			.collect(Collectors.toMap(Guardian::getId, Function.identity()));
		return list.stream().map(c -> {
			ClassEnrollment e = active.get(c.getId());
			ChildGuardian link = primary.get(c.getId());
			Guardian g = link == null ? null : guardianById.get(link.getGuardianId());
			return new ChildItem(c.getId(), c.getSchoolId(), c.getChildCode(), c.getFullName(), c.getNickname(),
					c.getGender(), c.getDob(), c.getStatus(), e == null ? null : e.getClassId(),
					e == null ? null : classNames.get(e.getClassId()), g == null ? null : g.getFullName(),
					g == null ? null : g.getPhone(), c.getAllergyNote());
		}).toList();
	}

	private Map<UUID, String> classNames(Collection<UUID> ids) {
		return classes.findAllById(Set.copyOf(ids))
			.stream()
			.collect(Collectors.toMap(SchoolClass::getId, SchoolClass::getName));
	}

	private static ChildDocumentDto toDto(ChildDocument d, DocumentType t, StoredFile file) {
		return new ChildDocumentDto(d.getId(),
				new DocumentTypeDto(t.getId(), t.getCode(), t.getName(), t.getCategory(), t.isHasExpiry()), ref(file),
				d.getIssuedDate(), d.getExpiryDate(), d.getNote(), d.getCreatedAt());
	}

	private static FileRef ref(StoredFile file) {
		return file == null ? null
				: new FileRef(file.getId(), file.getOriginalName(), file.getMimeType(), file.getSizeBytes());
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

	private static String digitsOrNull(String s) {
		String digits = s == null ? "" : s.replaceAll("\\D", "");
		return digits.isEmpty() ? null : digits;
	}

}
