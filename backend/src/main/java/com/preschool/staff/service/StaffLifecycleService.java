package com.preschool.staff.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.preschool.account.entity.User;
import com.preschool.account.repository.RefreshTokenRepository;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditLogRepository;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.document.entity.StaffDocument;
import com.preschool.document.repository.DocumentTypeRepository;
import com.preschool.document.repository.StaffDocumentRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffActionDtos;
import com.preschool.staff.dto.StaffActionDtos.AssignmentDto;
import com.preschool.staff.dto.StaffActionDtos.BankRequest;
import com.preschool.staff.dto.StaffActionDtos.HistoryEvent;
import com.preschool.staff.dto.StaffActionDtos.SalaryConfigDto;
import com.preschool.staff.dto.StaffActionDtos.SalaryConfigRequest;
import com.preschool.staff.dto.StaffActionDtos.StaffHistory;
import com.preschool.staff.dto.StaffActionDtos.TerminateRequest;
import com.preschool.staff.dto.StaffActionDtos.TransferRequest;
import com.preschool.staff.dto.StaffDtos.BankInfo;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.SalaryMode;
import com.preschool.staff.entity.StaffSalaryConfig;
import com.preschool.staff.entity.StaffSchoolAssignment;
import com.preschool.staff.repository.StaffSalaryConfigRepository;
import com.preschool.staff.repository.StaffSchoolAssignmentRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Thao tác vòng đời hồ sơ: cấu hình lương (chỉ thêm bản mới), ngân hàng, điều chuyển cơ sở (kể cả ngày tương lai),
 * cho nghỉ việc, lịch sử. Mục lương/ngân hàng chỉ người được xem lương mới thấy (kể cả trong lịch sử).
 */
@Service
public class StaffLifecycleService {

	private static final Logger log = LoggerFactory.getLogger(StaffLifecycleService.class);

	/** Mục nhật ký ai xem được hồ sơ cũng thấy. */
	private static final Set<String> PUBLIC_HISTORY = Set.of("staff", "staff.contract", "staff.document",
			"staff.dependent", "staff.certificate", "staff.training", "staff.transfer", "staff.terminate");

	/** Mục nhật ký chỉ người được xem lương mới thấy. */
	private static final Set<String> SALARY_HISTORY = Set.of("staff.salary", "staff.bank");

	private final StaffService staffService;

	private final StaffAccess access;

	private final StaffSalaryConfigRepository salaryConfigs;

	private final StaffSchoolAssignmentRepository assignments;

	private final StaffDocumentRepository documents;

	private final DocumentTypeRepository documentTypes;

	private final SchoolRepository schools;

	private final UserRepository users;

	private final RefreshTokenRepository refreshTokens;

	private final AuditLogRepository auditLogs;

	private final AuditService audit;

	private final FileService fileService;

	private final JsonMapper jsonMapper;

	private final Clock clock;

	public StaffLifecycleService(StaffService staffService, StaffAccess access,
			StaffSalaryConfigRepository salaryConfigs, StaffSchoolAssignmentRepository assignments,
			StaffDocumentRepository documents, DocumentTypeRepository documentTypes, SchoolRepository schools,
			UserRepository users, RefreshTokenRepository refreshTokens, AuditLogRepository auditLogs,
			AuditService audit, FileService fileService, JsonMapper jsonMapper, Clock clock) {
		this.staffService = staffService;
		this.access = access;
		this.salaryConfigs = salaryConfigs;
		this.assignments = assignments;
		this.documents = documents;
		this.documentTypes = documentTypes;
		this.schools = schools;
		this.users = users;
		this.refreshTokens = refreshTokens;
		this.auditLogs = auditLogs;
		this.audit = audit;
		this.fileService = fileService;
		this.jsonMapper = jsonMapper;
		this.clock = clock;
	}

	// ------------------------------------------------------------ lương

	@Transactional(readOnly = true)
	public List<SalaryConfigDto> salaryConfigs(UUID staffId) {
		Staff staff = staffService.find(staffId);
		access.requireViewSalary(staff);
		return toSalaryDtos(salaryConfigs.findByStaffIdOrderByEffectiveFromDesc(staffId));
	}

	/** Điều chỉnh lương = thêm cấu hình mới có ngày hiệu lực; bản cũ giữ nguyên làm lịch sử. */
	@Transactional
	public SalaryConfigDto addSalaryConfig(UUID staffId, SalaryConfigRequest request) {
		Staff staff = staffService.find(staffId);
		access.requireManageSalary(staff);
		if (request.salaryMode() == SalaryMode.FIXED && request.baseSalary() == null) {
			throw fieldError("baseSalary", "Nhập lương cơ bản cho lương cứng");
		}
		if (request.salaryMode() == SalaryMode.COEFFICIENT && request.coefficient() == null) {
			throw fieldError("coefficient", "Nhập hệ số cho lương hệ số");
		}
		if (salaryConfigs.existsByStaffIdAndEffectiveFrom(staffId, request.effectiveFrom())) {
			throw fieldError("effectiveFrom", "Đã có cấu hình lương hiệu lực từ ngày này");
		}
		Map<String, Long> allowances = new LinkedHashMap<>();
		if (request.allowances() != null) {
			request.allowances().forEach((key, value) -> {
				if (!StaffActionDtos.ALLOWANCE_KEYS.contains(key)) {
					throw fieldError("allowances", "Loại phụ cấp không hợp lệ: " + key);
				}
				if (value != null && value > 0) {
					allowances.put(key, value);
				}
			});
		}
		StaffSalaryConfig config = salaryConfigs.saveAndFlush(new StaffSalaryConfig(staffId, request.effectiveFrom(),
				request.salaryMode(), request.salaryMode() == SalaryMode.FIXED ? request.baseSalary() : null,
				request.salaryMode() == SalaryMode.COEFFICIENT ? request.coefficient() : null, request.region(),
				jsonMapper.writeValueAsString(allowances), request.insuranceSalary(), blankToNull(request.note())));
		SalaryConfigDto dto = toSalaryDtos(List.of(config)).getFirst();
		audit.record("staff.salary", staffId, Action.CREATE, null, dto);
		return dto;
	}

	@Transactional
	public StaffDetail updateBank(UUID staffId, BankRequest request) {
		Staff staff = staffService.find(staffId);
		access.requireManageSalary(staff);
		BankInfo before = new BankInfo(staff.getBankName(), staff.getBankAccountNo(), staff.getBankAccountHolder());
		staff.setBankName(blankToNull(request.bankName()));
		staff.setBankAccountNo(blankToNull(request.bankAccountNo()));
		staff.setBankAccountHolder(blankToNull(request.bankAccountHolder()));
		audit.record("staff.bank", staffId, Action.UPDATE, before,
				new BankInfo(staff.getBankName(), staff.getBankAccountNo(), staff.getBankAccountHolder()));
		return staffService.toDetail(staff);
	}

	// ------------------------------------------------------------ điều chuyển

	/**
	 * Đóng giai đoạn ở cơ sở cũ (đến ngày trước hiệu lực) và mở giai đoạn ở cơ sở mới. Hiệu lực hôm nay hoặc trước
	 * đó thì đổi cơ sở ngay; tương lai thì job {@link #applyDueTransfers} đổi khi tới ngày.
	 */
	@Transactional
	public StaffDetail transfer(UUID staffId, TransferRequest request) {
		Staff staff = staffService.find(staffId);
		if (!access.canTransfer(staff)) {
			throw ApiException.forbidden("TRANSFER_FORBIDDEN",
					"Chỉ văn phòng điều hành hoặc chủ chuỗi được điều chuyển nhân viên.");
		}
		if (!staff.isActive()) {
			throw ApiException.conflict("STAFF_TERMINATED", "Nhân viên đã nghỉ việc, không điều chuyển được.");
		}
		if (!SchoolScope.require().access().canAccess(request.schoolId())) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
		}
		List<StaffSchoolAssignment> history = assignments.findByStaffIdOrderByFromDateAsc(staffId);
		StaffSchoolAssignment current = history.stream().filter(a -> a.getToDate() == null).reduce((a, b) -> b)
			.orElse(null);
		UUID currentSchool = current != null ? current.getSchoolId() : staff.getSchoolId();
		if (request.schoolId().equals(currentSchool)) {
			throw fieldError("schoolId", "Nhân viên đang thuộc cơ sở này");
		}
		LocalDate last = history.isEmpty() ? staff.getStartDate() : history.getLast().getFromDate();
		if (!request.effectiveDate().isAfter(last)) {
			throw fieldError("effectiveDate", "Ngày hiệu lực phải sau lần điều chuyển gần nhất (" + last + ")");
		}

		UUID decisionFileId = null;
		if (request.decisionFileId() != null) {
			StoredFile file = fileService.requireAttachable(request.decisionFileId());
			decisionFileId = file.getId();
			addDecisionDocument(staffId, "QUYET_DINH_DIEU_CHUYEN", decisionFileId, request.effectiveDate());
		}
		if (current != null) {
			current.close(request.effectiveDate().minusDays(1));
		}
		StaffSchoolAssignment next = assignments.save(new StaffSchoolAssignment(staffId, request.schoolId(),
				request.effectiveDate(), decisionFileId, blankToNull(request.note())));

		UUID fromSchool = staff.getSchoolId();
		boolean immediate = !request.effectiveDate().isAfter(LocalDate.now(clock));
		if (immediate) {
			staff.setSchoolId(request.schoolId());
		}
		audit.record("staff.transfer", staffId, Action.UPDATE, Map.of("schoolId", fromSchool),
				Map.of("schoolId", request.schoolId(), "effectiveDate", request.effectiveDate(), "assignmentId",
						next.getId(), "applied", immediate));
		return staffService.toDetail(staff);
	}

	/** Job hằng ngày: áp dụng các điều chuyển tới ngày hiệu lực. Không có SchoolScope → không lọc cơ sở. */
	@Transactional
	public int applyDueTransfers(LocalDate today) {
		List<StaffSchoolAssignment> due = assignments.findDueTransfers(today);
		for (StaffSchoolAssignment assignment : due) {
			staffService.findUnscoped(assignment.getStaffId()).setSchoolId(assignment.getSchoolId());
			log.info("Áp dụng điều chuyển nhân viên {} sang cơ sở {}", assignment.getStaffId(),
					assignment.getSchoolId());
		}
		return due.size();
	}

	// ------------------------------------------------------------ nghỉ việc

	/** Cho nghỉ việc: đóng giai đoạn làm việc, khóa tài khoản đăng nhập và thu hồi mọi phiên. */
	@Transactional
	public StaffDetail terminate(UUID staffId, TerminateRequest request) {
		Staff staff = staffService.find(staffId);
		if (!access.canTerminate(staff)) {
			throw ApiException.forbidden("TERMINATE_FORBIDDEN", "Bạn không có quyền cho nhân viên này nghỉ việc.");
		}
		if (!staff.isActive()) {
			throw ApiException.conflict("STAFF_TERMINATED", "Nhân viên đã nghỉ việc.");
		}
		if (request.endDate().isBefore(staff.getStartDate())) {
			throw fieldError("endDate", "Ngày nghỉ việc phải sau ngày vào làm");
		}
		if (request.decisionFileId() != null) {
			fileService.requireAttachable(request.decisionFileId());
			addDecisionDocument(staffId, "QUYET_DINH_CHAM_DUT", request.decisionFileId(), request.endDate());
		}
		staff.terminate(request.endDate(), request.reason().trim());
		assignments.findByStaffIdOrderByFromDateAsc(staffId).stream()
			.filter(a -> a.getToDate() == null)
			.forEach(a -> a.close(request.endDate()));
		users.findByStaffId(staffId).ifPresent(user -> {
			user.setActive(false);
			refreshTokens.revokeAllForUser(user.getId(), Instant.now(clock));
		});
		audit.record("staff.terminate", staffId, Action.UPDATE, Map.of("status", "ACTIVE"),
				Map.of("status", "TERMINATED", "endDate", request.endDate(), "reason", request.reason().trim()));
		return staffService.toDetail(staff);
	}

	// ------------------------------------------------------------ lịch sử

	@Transactional(readOnly = true)
	public StaffHistory history(UUID staffId) {
		Staff staff = staffService.find(staffId);
		access.requireView(staff);
		boolean salaryVisible = access.canViewSalary(staff);
		LocalDate today = LocalDate.now(clock);

		Map<UUID, String> schoolNames = schools.findAll().stream()
			.collect(Collectors.toMap(School::getId, School::getName));
		List<StaffSchoolAssignment> rows = assignments.findByStaffIdOrderByFromDateAsc(staffId);
		Map<UUID, StoredFile> files = fileService.findForModule(
				rows.stream().map(StaffSchoolAssignment::getDecisionFileId).filter(Objects::nonNull).toList());
		List<AssignmentDto> assignmentDtos = rows.stream()
			.map(a -> new AssignmentDto(a.getId(), a.getSchoolId(), schoolNames.get(a.getSchoolId()), a.getFromDate(),
					a.getToDate(), StaffRecordsService.ref(files.get(a.getDecisionFileId())), a.getNote(),
					a.getFromDate().isAfter(today)))
			.toList();

		Set<String> entities = salaryVisible
				? Stream.concat(PUBLIC_HISTORY.stream(), SALARY_HISTORY.stream()).collect(Collectors.toSet())
				: PUBLIC_HISTORY;
		List<AuditLog> logs = auditLogs.findByEntityInAndEntityIdInOrderByCreatedAtDesc(entities, List.of(staffId));
		Map<UUID, String> userNames = users.findAllById(logs.stream().map(AuditLog::getUserId)
			.filter(Objects::nonNull).distinct().toList())
			.stream()
			.collect(Collectors.toMap(User::getId, User::getFullName));
		List<HistoryEvent> events = logs.stream()
			.map(l -> new HistoryEvent(l.getId(), l.getCreatedAt(), userNames.get(l.getUserId()), l.getEntity(),
					l.getAction(), parse(l.getBeforeData()), parse(l.getAfterData())))
			.toList();

		List<SalaryConfigDto> salary = salaryVisible
				? toSalaryDtos(salaryConfigs.findByStaffIdOrderByEffectiveFromDesc(staffId))
				: null;
		return new StaffHistory(assignmentDtos, salary, events);
	}

	// ------------------------------------------------------------ hỗ trợ

	private void addDecisionDocument(UUID staffId, String typeCode, UUID fileId, LocalDate issuedDate) {
		documentTypes.findByCode(typeCode).ifPresent(type -> {
			StaffDocument doc = documents.save(new StaffDocument(staffId, type.getId(), fileId, issuedDate, null, null));
			audit.record("staff.document", staffId, Action.CREATE, null,
					Map.of("documentType", typeCode, "fileId", fileId, "documentId", doc.getId()));
		});
	}

	private List<SalaryConfigDto> toSalaryDtos(List<StaffSalaryConfig> configs) {
		LocalDate today = LocalDate.now(clock);
		UUID currentId = configs.stream()
			.filter(c -> !c.getEffectiveFrom().isAfter(today))
			.max((a, b) -> a.getEffectiveFrom().compareTo(b.getEffectiveFrom()))
			.map(StaffSalaryConfig::getId)
			.orElse(null);
		Map<UUID, String> creators = users.findAllById(configs.stream().map(StaffSalaryConfig::getCreatedBy)
			.filter(Objects::nonNull).distinct().toList())
			.stream()
			.collect(Collectors.toMap(User::getId, User::getFullName));
		List<SalaryConfigDto> result = new ArrayList<>();
		for (StaffSalaryConfig c : configs) {
			result.add(new SalaryConfigDto(c.getId(), c.getEffectiveFrom(), c.getSalaryMode(), c.getBaseSalary(),
					c.getCoefficient(), c.getRegion(), parseAllowances(c.getAllowances()), c.getInsuranceSalary(),
					c.getNote(), c.getCreatedAt(), creators.get(c.getCreatedBy()), c.getId().equals(currentId)));
		}
		return result;
	}

	private Map<String, Long> parseAllowances(String json) {
		if (json == null || json.isBlank()) {
			return Map.of();
		}
		Map<String, Number> raw = jsonMapper.readValue(json, new TypeReference<Map<String, Number>>() {
		});
		Map<String, Long> result = new HashMap<>();
		raw.forEach((k, v) -> result.put(k, v == null ? 0L : v.longValue()));
		return result;
	}

	private Map<String, Object> parse(String json) {
		return json == null ? null : jsonMapper.readValue(json, new TypeReference<Map<String, Object>>() {
		});
	}

	private static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_FAILED", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
