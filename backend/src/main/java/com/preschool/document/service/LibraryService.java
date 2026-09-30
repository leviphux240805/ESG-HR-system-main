package com.preschool.document.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.mail.EmailService;
import com.preschool.common.web.PageResponse;
import com.preschool.document.dto.LibraryDtos.AckStats;
import com.preschool.document.dto.LibraryDtos.CreateDocumentRequest;
import com.preschool.document.dto.LibraryDtos.CreateFolderRequest;
import com.preschool.document.dto.LibraryDtos.DocumentDetail;
import com.preschool.document.dto.LibraryDtos.DocumentItem;
import com.preschool.document.dto.LibraryDtos.FolderDto;
import com.preschool.document.dto.LibraryDtos.MyAck;
import com.preschool.document.dto.LibraryDtos.NewVersionRequest;
import com.preschool.document.dto.LibraryDtos.ReaderDto;
import com.preschool.document.dto.LibraryDtos.RemindResponse;
import com.preschool.document.dto.LibraryDtos.UpdateDocumentRequest;
import com.preschool.document.dto.LibraryDtos.VersionDto;
import com.preschool.document.entity.DocFolder;
import com.preschool.document.entity.DocumentAck;
import com.preschool.document.entity.LibraryDocument;
import com.preschool.document.entity.LibraryDocumentVersion;
import com.preschool.document.repository.DocFolderRepository;
import com.preschool.document.repository.DocumentAckRepository;
import com.preschool.document.repository.LibraryDocumentRepository;
import com.preschool.document.repository.LibraryDocumentVersionRepository;
import com.preschool.document.service.LibraryReaderQuery.Reader;
import com.preschool.document.service.LibraryReaderQuery.Stats;
import com.preschool.notification.service.NotificationService;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

/** Thư viện văn bản: thư mục, văn bản, phiên bản, xác nhận đã đọc, nhắc người chưa đọc. */
@Service
public class LibraryService {

	private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	static final String NOTIFY_NEW = "LIBRARY_NEW";

	static final String NOTIFY_REMIND = "LIBRARY_REMIND";

	private final DocFolderRepository folders;

	private final LibraryDocumentRepository documents;

	private final LibraryDocumentVersionRepository versions;

	private final DocumentAckRepository acks;

	private final LibraryReaderQuery readerQuery;

	private final LibrarySearchQuery searchQuery;

	private final LibraryAccess access;

	private final FileService fileService;

	private final SchoolRepository schools;

	private final UserRepository users;

	private final NotificationService notifications;

	private final EmailService emailService;

	private final AuditService audit;

	private final Clock clock;

	public LibraryService(DocFolderRepository folders, LibraryDocumentRepository documents,
			LibraryDocumentVersionRepository versions, DocumentAckRepository acks, LibraryReaderQuery readerQuery,
			LibrarySearchQuery searchQuery, LibraryAccess access, FileService fileService, SchoolRepository schools,
			UserRepository users, NotificationService notifications, EmailService emailService, AuditService audit,
			Clock clock) {
		this.folders = folders;
		this.documents = documents;
		this.versions = versions;
		this.acks = acks;
		this.readerQuery = readerQuery;
		this.searchQuery = searchQuery;
		this.access = access;
		this.fileService = fileService;
		this.schools = schools;
		this.users = users;
		this.notifications = notifications;
		this.emailService = emailService;
		this.audit = audit;
		this.clock = clock;
	}

	// ------------------------------------------------------------ thư mục

	@Transactional(readOnly = true)
	public List<FolderDto> folders() {
		return folders.findAllByOrderByNameAsc().stream().map(this::toDto).toList();
	}

	@Transactional
	public FolderDto createFolder(CreateFolderRequest request) {
		UUID schoolId = request.schoolId();
		if (request.parentId() != null) {
			schoolId = findFolder(request.parentId()).getSchoolId();
		}
		else if (schoolId != null) {
			requireSchoolInScope(schoolId);
		}
		access.requirePublish(schoolId);
		DocFolder folder = saveFolder(new DocFolder(schoolId, request.parentId(), request.name().trim()));
		audit.record("library.folder", folder.getId(), Action.CREATE, null, toDto(folder));
		return toDto(folder);
	}

	@Transactional
	public FolderDto renameFolder(UUID id, String name) {
		DocFolder folder = findFolder(id);
		access.requirePublish(folder.getSchoolId());
		String before = folder.getName();
		folder.setName(name.trim());
		saveFolder(folder);
		audit.record("library.folder", id, Action.UPDATE, Map.of("name", before), Map.of("name", folder.getName()));
		return toDto(folder);
	}

	@Transactional
	public void deleteFolder(UUID id) {
		DocFolder folder = findFolder(id);
		access.requirePublish(folder.getSchoolId());
		if (folders.existsByParentId(id) || documents.existsByFolderId(id)) {
			throw ApiException.conflict("FOLDER_NOT_EMPTY", "Thư mục còn thư mục con hoặc văn bản, chưa xóa được.");
		}
		audit.record("library.folder", id, Action.DELETE, toDto(folder), null);
		folders.delete(folder);
	}

	private DocFolder saveFolder(DocFolder folder) {
		try {
			return folders.saveAndFlush(folder);
		}
		catch (org.springframework.dao.DataIntegrityViolationException ex) {
			String message = "Đã có thư mục cùng tên ở đây";
			throw ApiException.conflict("FOLDER_NAME_TAKEN", message + ".")
				.withFieldErrors(List.of(Map.of("field", "name", "message", message)));
		}
	}

	private DocFolder findFolder(UUID id) {
		return folders.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy thư mục."));
	}

	private FolderDto toDto(DocFolder f) {
		return new FolderDto(f.getId(), f.getSchoolId(), f.getParentId(), f.getName(),
				access.canPublish(f.getSchoolId()));
	}

	// ------------------------------------------------------------ văn bản

	@Transactional(readOnly = true)
	public PageResponse<DocumentItem> list(UUID folderId, boolean unfiled, String q, Pageable pageable) {
		SchoolScope scope = SchoolScope.require();
		var viewer = new LibrarySearchQuery.Viewer(scope.userId(), scope.effectiveSchoolIds(),
				scope.filterSchoolIds().isEmpty(), access.canPublish(null), access.publisherSchools());
		var criteria = new LibrarySearchQuery.Criteria(folderId, unfiled, q);
		long total = searchQuery.count(viewer, criteria);
		List<UUID> ids = searchQuery.find(viewer, criteria, pageable);
		Map<UUID, LibraryDocument> byId = documents.findAllById(ids).stream()
			.collect(Collectors.toMap(LibraryDocument::getId, Function.identity()));
		List<LibraryDocument> page = ids.stream().map(byId::get).filter(Objects::nonNull).toList();
		return new PageResponse<>(toItems(page), pageable.getPageNumber(), pageable.getPageSize(), total,
				(int) Math.ceil(total / (double) pageable.getPageSize()));
	}

	@Transactional(readOnly = true)
	public DocumentDetail get(UUID id) {
		LibraryDocument document = findViewable(id);
		List<LibraryDocumentVersion> list = versions.findByDocumentIdOrderByVersionNoDesc(id);
		Map<UUID, StoredFile> files = fileService.findForModule(list.stream().map(LibraryDocumentVersion::getFileId)
			.toList());
		Map<UUID, String> userNames = users.findAllById(list.stream().map(LibraryDocumentVersion::getCreatedBy)
			.filter(Objects::nonNull).distinct().toList())
			.stream().collect(Collectors.toMap(User::getId, User::getFullName));
		List<VersionDto> versionDtos = list.stream()
			.map(v -> new VersionDto(v.getId(), v.getVersionNo(), ref(files.get(v.getFileId())), v.getNote(),
					v.getCreatedAt(), userNames.get(v.getCreatedBy())))
			.toList();
		String folderName = document.getFolderId() == null ? null
				: folders.findById(document.getFolderId()).map(DocFolder::getName).orElse(null);
		return new DocumentDetail(toItems(List.of(document)).getFirst(), versionDtos, folderName,
				access.canManage(document) ? document.getLastRemindedAt() : null);
	}

	@Transactional
	public DocumentDetail create(CreateDocumentRequest request) {
		UUID schoolId = request.schoolId();
		if (schoolId != null) {
			requireSchoolInScope(schoolId);
		}
		access.requirePublish(schoolId);
		LibraryDocument document = new LibraryDocument(schoolId);
		document.setFolderId(folderFor(request.folderId(), schoolId));
		applyFields(document, request.title(), request.docNumber(), request.issuedDate(), request.effectiveTo(),
				request.visibleRoles());
		document.setRequireAck(request.requireAck());
		StoredFile file = fileService.requireAttachable(request.fileId());
		documents.saveAndFlush(document);
		versions.save(new LibraryDocumentVersion(document.getId(), 1, file.getId(), blankToNull(request.note())));
		audit.record("library.document", document.getId(), Action.CREATE, null, snapshot(document));
		if (document.isRequireAck()) {
			notifyReaders(document, NOTIFY_NEW, "Văn bản mới cần xác nhận đã đọc: " + document.getTitle());
		}
		return get(document.getId());
	}

	@Transactional
	public DocumentDetail update(UUID id, UpdateDocumentRequest request) {
		LibraryDocument document = findViewable(id);
		access.requireManage(document);
		Map<String, Object> before = snapshot(document);
		boolean ackTurnedOn = request.requireAck() && !document.isRequireAck();
		document.setFolderId(folderFor(request.folderId(), document.getSchoolId()));
		applyFields(document, request.title(), request.docNumber(), request.issuedDate(), request.effectiveTo(),
				request.visibleRoles());
		document.setRequireAck(request.requireAck());
		documents.saveAndFlush(document);
		audit.record("library.document", id, Action.UPDATE, before, snapshot(document));
		if (ackTurnedOn) {
			notifyReaders(document, NOTIFY_NEW, "Văn bản cần xác nhận đã đọc: " + document.getTitle());
		}
		return get(id);
	}

	@Transactional
	public void delete(UUID id) {
		LibraryDocument document = findViewable(id);
		access.requireManage(document);
		audit.record("library.document", id, Action.DELETE, snapshot(document), null);
		documents.delete(document);
	}

	/** Phiên bản mới (không ghi đè bản cũ); tùy chọn yêu cầu mọi người xác nhận lại. */
	@Transactional
	public DocumentDetail addVersion(UUID id, NewVersionRequest request) {
		LibraryDocument document = findViewable(id);
		access.requireManage(document);
		StoredFile file = fileService.requireAttachable(request.fileId());
		boolean reack = document.isRequireAck() && request.requireReack();
		int versionNo = document.nextVersion(reack);
		documents.saveAndFlush(document);
		versions.save(new LibraryDocumentVersion(id, versionNo, file.getId(), blankToNull(request.note())));
		audit.record("library.document", id, Action.UPDATE, null,
				Map.of("versionNo", versionNo, "fileId", file.getId(), "requireReack", reack));
		if (reack) {
			notifyReaders(document, NOTIFY_NEW,
					"Văn bản có phiên bản mới cần xác nhận lại: " + document.getTitle());
		}
		return get(id);
	}

	/** Người đọc xác nhận phiên bản hiện tại (gọi lại nhiều lần không sao). */
	@Transactional
	public DocumentDetail acknowledge(UUID id) {
		LibraryDocument document = findViewable(id);
		UUID staffId = SchoolScope.require().access().staffId();
		if (!document.isRequireAck()) {
			throw ApiException.badRequest("ACK_NOT_REQUIRED", "Văn bản này không yêu cầu xác nhận đã đọc.");
		}
		if (staffId == null || !readerQuery.isReader(id, staffId)) {
			throw ApiException.forbidden("ACK_FORBIDDEN", "Bạn không thuộc diện cần xác nhận văn bản này.");
		}
		int versionNo = document.getCurrentVersionNo();
		if (!acks.existsByDocumentIdAndStaffIdAndVersionNo(id, staffId, versionNo)) {
			acks.save(new DocumentAck(id, staffId, versionNo, Instant.now(clock)));
		}
		return get(id);
	}

	@Transactional(readOnly = true)
	public List<ReaderDto> readers(UUID id, Boolean acknowledged) {
		LibraryDocument document = findViewable(id);
		access.requireManage(document);
		Map<UUID, String> names = schoolNames();
		return readerQuery.readers(id, acknowledged).stream()
			.map(r -> new ReaderDto(r.staffId(), r.staffCode(), r.fullName(), r.schoolId(), names.get(r.schoolId()),
					r.acknowledgedAt()))
			.toList();
	}

	/** Nhắc người chưa đọc (thông báo + email), tối đa 1 lần/ngày cho mỗi văn bản. */
	@Transactional
	public RemindResponse remind(UUID id) {
		LibraryDocument document = findViewable(id);
		access.requireManage(document);
		if (!document.isRequireAck()) {
			throw ApiException.badRequest("ACK_NOT_REQUIRED", "Văn bản này không yêu cầu xác nhận đã đọc.");
		}
		LocalDate today = LocalDate.now(clock.withZone(VN));
		if (document.getLastRemindedAt() != null
				&& document.getLastRemindedAt().atZone(VN).toLocalDate().equals(today)) {
			throw ApiException.conflict("REMIND_LIMIT", "Hôm nay đã nhắc người chưa đọc. Có thể nhắc lại từ ngày mai.");
		}
		List<Reader> unread = readerQuery.readers(id, false);
		String title = "Nhắc đọc văn bản: " + document.getTitle();
		String link = link(document);
		for (Reader reader : unread) {
			notifications.notify(reader.userId(), NOTIFY_REMIND, title, "Vui lòng đọc và bấm “Tôi đã đọc”.", link,
					"library-remind:%s:%s:%s".formatted(id, today, reader.staffId()));
			String text = "Chào %s,\n\nBạn chưa xác nhận đã đọc văn bản \"%s\". Vui lòng mở mục Của tôi › Văn bản cần đọc để đọc và bấm \"Tôi đã đọc\"."
				.formatted(reader.fullName(), document.getTitle());
			String html = "<p>Chào %s,</p><p>Bạn chưa xác nhận đã đọc văn bản <b>%s</b>. Vui lòng mở mục <b>Của tôi › Văn bản cần đọc</b> để đọc và bấm “Tôi đã đọc”.</p>"
				.formatted(HtmlUtils.htmlEscape(reader.fullName()), HtmlUtils.htmlEscape(document.getTitle()));
			emailService.send(reader.email(), "Nhắc đọc văn bản: " + document.getTitle(), text, html);
		}
		document.setLastRemindedAt(Instant.now(clock));
		audit.record("library.document", id, Action.UPDATE, null,
				Map.of("remindedOn", DATE.format(today), "reminded", unread.size()));
		return new RemindResponse(unread.size());
	}

	@Transactional(readOnly = true)
	public DownloadUrlResponse fileUrl(UUID id, int versionNo, boolean inline) {
		findViewable(id);
		LibraryDocumentVersion version = versions.findByDocumentIdAndVersionNo(id, versionNo)
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy phiên bản."));
		StoredFile file = fileService.findForModule(List.of(version.getFileId())).get(version.getFileId());
		if (file == null) {
			throw ApiException.notFound("Không tìm thấy file.");
		}
		return fileService.presignDownload(file, inline);
	}

	// ------------------------------------------------------------ hỗ trợ

	/** Văn bản trong phạm vi cơ sở (filter) mà người dùng được xem theo vai trò; không thì 404 (không lộ tồn tại). */
	private LibraryDocument findViewable(UUID id) {
		return documents.findById(id).filter(access::canView)
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy văn bản."));
	}

	private UUID folderFor(UUID folderId, UUID schoolId) {
		if (folderId == null) {
			return null;
		}
		DocFolder folder = findFolder(folderId);
		if (folder.getSchoolId() != null && !folder.getSchoolId().equals(schoolId)) {
			String message = "Thư mục thuộc cơ sở khác với phạm vi văn bản";
			throw ApiException.badRequest("FOLDER_SCOPE", message + ".")
				.withFieldErrors(List.of(Map.of("field", "folderId", "message", message)));
		}
		return folder.getId();
	}

	private static void applyFields(LibraryDocument d, String title, String docNumber, LocalDate issuedDate,
			LocalDate effectiveTo, List<com.preschool.account.entity.RoleCode> roles) {
		if (issuedDate != null && effectiveTo != null && effectiveTo.isBefore(issuedDate)) {
			String message = "Ngày hết hiệu lực phải sau ngày ban hành";
			throw ApiException.badRequest("VALIDATION_FAILED", message + ".")
				.withFieldErrors(List.of(Map.of("field", "effectiveTo", "message", message)));
		}
		d.setTitle(title.trim());
		d.setDocNumber(blankToNull(docNumber));
		d.setIssuedDate(issuedDate);
		d.setEffectiveTo(effectiveTo);
		d.setVisibleRoles(roles);
	}

	private List<DocumentItem> toItems(List<LibraryDocument> list) {
		UUID staffId = SchoolScope.require().access().staffId();
		List<UUID> managed = list.stream().filter(d -> d.isRequireAck() && access.canManage(d))
			.map(LibraryDocument::getId).toList();
		Map<UUID, Stats> stats = readerQuery.stats(managed);
		Map<UUID, String> names = schoolNames();
		List<DocumentItem> items = new ArrayList<>();
		for (LibraryDocument d : list) {
			AckStats ackStats = managed.contains(d.getId())
					? toStats(stats.getOrDefault(d.getId(), new Stats(0, 0)))
					: null;
			items.add(new DocumentItem(d.getId(), d.getFolderId(), d.getSchoolId(), names.get(d.getSchoolId()),
					d.getTitle(), d.getDocNumber(), d.getIssuedDate(), d.getEffectiveTo(), d.getVisibleRoles(),
					d.isRequireAck(), d.getAckVersionNo(), d.getCurrentVersionNo(), ackStats, myAck(d, staffId),
					access.canManage(d), d.getCreatedAt()));
		}
		return items;
	}

	private MyAck myAck(LibraryDocument d, UUID staffId) {
		if (!d.isRequireAck() || staffId == null || !readerQuery.isReader(d.getId(), staffId)) {
			return new MyAck(false, null);
		}
		Instant at = acks.findFirstByDocumentIdAndStaffIdOrderByVersionNoDesc(d.getId(), staffId)
			.filter(a -> a.getVersionNo() >= d.getAckVersionNo())
			.map(DocumentAck::getAcknowledgedAt)
			.orElse(null);
		return new MyAck(true, at);
	}

	private static AckStats toStats(Stats s) {
		return new AckStats(s.required(), s.acknowledged());
	}

	private void notifyReaders(LibraryDocument document, String type, String title) {
		String body = document.getDocNumber() == null ? null : "Số hiệu " + document.getDocNumber();
		for (Reader reader : readerQuery.readers(document.getId(), false)) {
			notifications.notify(reader.userId(), type, title, body, link(document),
					"library:%s:v%s:%s".formatted(document.getId(), document.getAckVersionNo(), reader.staffId()));
		}
	}

	private static String link(LibraryDocument document) {
		return "/tai-lieu/" + document.getId();
	}

	private static Map<String, Object> snapshot(LibraryDocument d) {
		Map<String, Object> map = new java.util.LinkedHashMap<>();
		map.put("title", d.getTitle());
		map.put("docNumber", d.getDocNumber());
		map.put("schoolId", d.getSchoolId());
		map.put("folderId", d.getFolderId());
		map.put("issuedDate", d.getIssuedDate());
		map.put("effectiveTo", d.getEffectiveTo());
		map.put("visibleRoles", d.getVisibleRoles());
		map.put("requireAck", d.isRequireAck());
		map.put("ackVersionNo", d.getAckVersionNo());
		map.put("currentVersionNo", d.getCurrentVersionNo());
		return map;
	}

	private static FileRef ref(StoredFile f) {
		return f == null ? null : new FileRef(f.getId(), f.getOriginalName(), f.getMimeType(), f.getSizeBytes());
	}

	private Map<UUID, String> schoolNames() {
		return schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
	}

	private static void requireSchoolInScope(UUID schoolId) {
		if (!SchoolScope.require().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
		}
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
