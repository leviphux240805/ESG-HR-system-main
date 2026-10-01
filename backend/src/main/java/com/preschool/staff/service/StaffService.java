package com.preschool.staff.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.UserRole;
import com.preschool.account.repository.UserRepository;
import com.preschool.account.entity.RoleAssignment;
import com.preschool.account.service.AccountService;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.web.PageResponse;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffDtos.CreateStaffRequest;
import com.preschool.staff.dto.StaffDtos.DuplicateCheckRequest;
import com.preschool.staff.dto.StaffDtos.ExpiringItem;
import com.preschool.staff.dto.StaffDtos.FieldIssue;
import com.preschool.staff.dto.StaffDtos.LinkedAccount;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.dto.StaffDtos.StaffFields;
import com.preschool.staff.dto.StaffDtos.StaffListItem;
import com.preschool.staff.dto.StaffDtos.StaffSummary;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffContract;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.StaffStatus;
import com.preschool.staff.entity.StaffSchoolAssignment;
import com.preschool.staff.mapper.StaffMapper;
import com.preschool.staff.repository.StaffContractRepository;
import com.preschool.staff.repository.StaffRepository;
import com.preschool.staff.repository.StaffSchoolAssignmentRepository;

import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Hồ sơ nhân viên: danh sách, tóm tắt, xem, tạo (kèm tài khoản), sửa. Mọi thay đổi ghi audit_logs. */
@Service
public class StaffService {

	/** Số ngày trước khi hết hạn thì cảnh báo. */
	public static final int EXPIRY_WARNING_DAYS = 30;

	static final String AUDIT_ENTITY = "staff";

	private static final Set<String> SORTABLE = Set.of("fullName", "staffCode", "startDate", "position");

	private final StaffRepository staffRepo;

	private final StaffContractRepository contracts;

	private final StaffSchoolAssignmentRepository assignments;

	private final SchoolRepository schools;

	private final UserRepository users;

	private final AccountService accountService;

	private final AuditService audit;

	private final StaffMapper mapper;

	private final StaffAccess access;

	private final StaffExpiryQuery expiryQuery;

	private final FileService fileService;

	private final Clock clock;

	public StaffService(StaffRepository staffRepo, StaffContractRepository contracts,
			StaffSchoolAssignmentRepository assignments, SchoolRepository schools, UserRepository users,
			AccountService accountService, AuditService audit, StaffMapper mapper, StaffAccess access,
			StaffExpiryQuery expiryQuery, FileService fileService, Clock clock) {
		this.staffRepo = staffRepo;
		this.contracts = contracts;
		this.assignments = assignments;
		this.schools = schools;
		this.users = users;
		this.accountService = accountService;
		this.audit = audit;
		this.mapper = mapper;
		this.access = access;
		this.expiryQuery = expiryQuery;
		this.fileService = fileService;
		this.clock = clock;
	}

	public record ListFilter(String q, UUID schoolId, Position position, StaffStatus status, boolean contractExpiring) {
	}

	// ------------------------------------------------------------ đọc

	@Transactional(readOnly = true)
	public PageResponse<StaffListItem> list(ListFilter filter, Pageable pageable) {
		requireList();
		requireSchoolInScope(filter.schoolId());
		Page<Staff> page = staffRepo.findAll(specOf(filter), sanitize(pageable));

		Map<UUID, String> schoolNames = schoolNames();
		Map<UUID, LocalDate> contractEnds = new HashMap<>();
		if (!page.isEmpty()) {
			contracts.findCurrentContractEnds(page.map(Staff::getId).getContent())
				.forEach(c -> contractEnds.put(c.getStaffId(), c.getEndDate()));
		}
		Map<UUID, String> photos = photoUrls(page.getContent());
		return PageResponse.of(page, s -> new StaffListItem(s.getId(), s.getStaffCode(), s.getFullName(),
				s.getPhotoFileId(), photos.get(s.getId()), s.getPosition(), s.getSchoolId(), schoolNames.get(s.getSchoolId()), s.getPhone(),
				s.getStartDate(), s.getStatus(), contractEnds.get(s.getId())));
	}

	/** Danh sách đầy đủ theo bộ lọc hoặc theo id (xuất Excel). */
	@Transactional(readOnly = true)
	public List<Staff> listForExport(ListFilter filter, List<UUID> ids) {
		requireList();
		requireSchoolInScope(filter.schoolId());
		Specification<Staff> spec = specOf(filter);
		if (ids != null && !ids.isEmpty()) {
			spec = spec.and((root, q, cb) -> root.get("id").in(ids));
		}
		return staffRepo.findAll(spec, Sort.by("staffCode"));
	}

	@Transactional(readOnly = true)
	public StaffSummary summary(UUID schoolId) {
		requireList();
		requireSchoolInScope(schoolId);
		Map<Position, Long> byPosition = new EnumMap<>(Position.class);
		staffRepo.countActiveByPosition(schoolId).forEach(p -> byPosition.put(p.getPosition(), p.getTotal()));
		LocalDate today = LocalDate.now(clock);
		long expiring = expiryQuery.count(scopedSchools(schoolId), today, today.plusDays(EXPIRY_WARNING_DAYS), null);
		long total = byPosition.values().stream().mapToLong(Long::longValue).sum();
		return new StaffSummary(total, byPosition, expiring);
	}

	/** Giấy tờ hết hạn trong `within` ngày tới của nhân viên đang làm (theo phạm vi đang chọn). */
	@Transactional(readOnly = true)
	public PageResponse<ExpiringItem> expiring(int within, StaffExpiryQuery.Kind kind, UUID schoolId,
			Pageable pageable) {
		requireList();
		requireSchoolInScope(schoolId);
		if (within < 1 || within > 365) {
			throw ApiException.badRequest("WITHIN_INVALID", "Khoảng thời gian phải từ 1 đến 365 ngày.");
		}
		LocalDate today = LocalDate.now(clock);
		Set<UUID> schoolIds = scopedSchools(schoolId);
		long total = expiryQuery.count(schoolIds, today, today.plusDays(within), kind);
		Map<UUID, String> names = schoolNames();
		List<ExpiringItem> items = expiryQuery
			.find(schoolIds, today, today.plusDays(within), kind, pageable.getPageSize(), pageable.getOffset())
			.stream()
			.map(i -> new ExpiringItem(i.kind().name(), i.recordId(), i.staffId(), i.staffCode(), i.staffName(),
					i.schoolId(), names.get(i.schoolId()), i.title(), i.expiryDate(),
					java.time.temporal.ChronoUnit.DAYS.between(today, i.expiryDate()), i.kind().tab()))
			.toList();
		return new PageResponse<>(items, pageable.getPageNumber(), pageable.getPageSize(), total,
				(int) Math.ceil(total / (double) pageable.getPageSize()));
	}

	/** Trường trong phạm vi truy vấn native ("Tất cả trường" = mọi trường được gán). */
	private static Set<UUID> scopedSchools(UUID schoolId) {
		return schoolId != null ? Set.of(schoolId) : SchoolScope.require().effectiveSchoolIds();
	}

	@Transactional(readOnly = true)
	public StaffDetail get(UUID id) {
		Staff staff = find(id);
		access.requireView(staff);
		return toDetail(staff);
	}

	/** Hồ sơ trong phạm vi cơ sở đang chọn; ngoài phạm vi (hoặc đã xóa) coi như không tồn tại. */
	public Staff find(UUID id) {
		return staffRepo.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy nhân viên."));
	}

	/** Cho job nền (không có SchoolScope nên không lọc cơ sở). */
	public Staff findUnscoped(UUID id) {
		return staffRepo.findById(id).orElseThrow(() -> new IllegalStateException("Không có nhân viên " + id));
	}

	// ------------------------------------------------------------ ghi

	@Transactional
	public StaffDetail create(CreateStaffRequest request) {
		UUID schoolId = resolveSchool(request.schoolId());
		if (!access.canCreateIn(schoolId)) {
			throw ApiException.forbidden("STAFF_FORBIDDEN", "Bạn không có quyền thêm nhân viên ở trường này.");
		}
		if (request.account() != null && !access.canCreateAccounts()) {
			throw ApiException.forbidden("ACCOUNT_FORBIDDEN", "Chỉ hiệu trưởng được tạo tài khoản đăng nhập.");
		}

		Staff staff = new Staff(schoolId, request.fields().fullName(), request.fields().position(),
				request.fields().startDate());
		mapper.apply(request.fields(), staff);
		normalize(staff);
		rejectDuplicates(staff, null);
		staffRepo.saveAndFlush(staff);
		assignments.save(new StaffSchoolAssignment(staff.getId(), schoolId, staff.getStartDate(), null, "Tiếp nhận"));
		audit.record(AUDIT_ENTITY, staff.getId(), Action.CREATE, null, mapper.toFields(staff));

		if (request.account() != null) {
			accountService.create(staff.getEmail(), staff.getPhone(), staff.getFullName(), staff.getId(),
					request.account().roles().stream()
						.map(r -> new RoleAssignment(r.role(), r.schoolId(), r.functionGroups()))
						.toList());
		}
		// Đọc lại để có mã NV do DB sinh
		return toDetail(staffRepo.findById(staff.getId()).orElseThrow());
	}

	@Transactional
	public StaffDetail update(UUID id, StaffFields fields) {
		Staff staff = find(id);
		access.requireEdit(staff);
		StaffFields before = mapper.toFields(staff);
		mapper.apply(fields, staff);
		normalize(staff);
		rejectDuplicates(staff, staff.getId());
		audit.record(AUDIT_ENTITY, staff.getId(), Action.UPDATE, before, mapper.toFields(staff));
		return toDetail(staff);
	}

	@Transactional(readOnly = true)
	public List<FieldIssue> checkDuplicates(DuplicateCheckRequest request) {
		requireList();
		return duplicates(normalizeCitizenId(request.citizenId()), normalizePhone(request.phone()),
				normalizeEmail(request.email()), request.excludeStaffId());
	}

	// ------------------------------------------------------------ hỗ trợ

	StaffDetail toDetail(Staff staff) {
		LinkedAccount account = users.findByStaffId(staff.getId())
			.map(u -> new LinkedAccount(u.getId(), u.getEmail(), u.isActive(),
					u.getRoles().stream().map(UserRole::getRoleCode).distinct().toList()))
			.orElse(null);
		return mapper.toDetail(staff, schoolNames().get(staff.getSchoolId()), photoUrls(List.of(staff)).get(staff.getId()),
				access.canViewSalary(staff) ? mapper.toBank(staff) : null, account, access.permissionsOn(staff));
	}

	/** Link ảnh có hạn cho các hồ sơ có ảnh (thẻ img không gửi được header xác thực). */
	private Map<UUID, String> photoUrls(List<Staff> staffList) {
		Map<UUID, StoredFile> files = fileService.findForModule(
				staffList.stream().map(Staff::getPhotoFileId).filter(java.util.Objects::nonNull).distinct().toList());
		Map<UUID, String> urls = new HashMap<>();
		for (Staff s : staffList) {
			StoredFile file = s.getPhotoFileId() == null ? null : files.get(s.getPhotoFileId());
			if (file != null && file.getStatus() == StoredFile.Status.READY) {
				urls.put(s.getId(), fileService.presignDownload(file, true).url());
			}
		}
		return urls;
	}

	private void rejectDuplicates(Staff staff, UUID excludeId) {
		List<FieldIssue> issues = new ArrayList<>(
				duplicates(staff.getCitizenId(), staff.getPhone(), staff.getEmail(), excludeId));
		if (staff.getMachineCode() != null
				&& staffRepo.machineCodeTaken(staff.getSchoolId(), staff.getMachineCode(), excludeId)) {
			issues.add(new FieldIssue("machineCode", "mã chấm công đã dùng cho nhân viên khác trong cơ sở"));
		}
		if (!issues.isEmpty()) {
			throw ApiException.conflict("STAFF_DUPLICATE", "Thông tin trùng với một hồ sơ nhân viên khác.")
				.withFieldErrors(issues.stream().map(i -> Map.of("field", i.field(), "message", i.message())).toList());
		}
	}

	/** Trùng trong tổ chức (kể cả cơ sở người dùng không thấy) nhưng không cho biết là hồ sơ nào. */
	private List<FieldIssue> duplicates(String citizenId, String phone, String email, UUID excludeId) {
		List<FieldIssue> issues = new ArrayList<>();
		if (citizenId != null && staffRepo.citizenIdTakenInOrganization(SchoolScope.require().organizationId(), citizenId, excludeId)) {
			issues.add(new FieldIssue("citizenId", "số CCCD đã có trong hồ sơ nhân viên khác"));
		}
		if (phone != null && staffRepo.phoneTakenInOrganization(SchoolScope.require().organizationId(), phone, excludeId)) {
			issues.add(new FieldIssue("phone", "số điện thoại đã có trong hồ sơ nhân viên khác"));
		}
		if (email != null && staffRepo.emailTakenInOrganization(SchoolScope.require().organizationId(), email, excludeId)) {
			issues.add(new FieldIssue("email", "email đã có trong hồ sơ nhân viên khác"));
		}
		return issues;
	}

	private static void normalize(Staff staff) {
		staff.setCitizenId(normalizeCitizenId(staff.getCitizenId()));
		staff.setPhone(normalizePhone(staff.getPhone()));
		staff.setEmail(normalizeEmail(staff.getEmail()));
		staff.setMachineCode(staff.getMachineCode() == null || staff.getMachineCode().isBlank() ? null
				: staff.getMachineCode().trim().toUpperCase(Locale.ROOT));
		staff.setFullName(staff.getFullName().trim().replaceAll("\\s+", " "));
	}

	static String normalizeCitizenId(String value) {
		return value == null || value.isBlank() ? null : value.replaceAll("\\s", "");
	}

	/** Bỏ ký tự không phải số; đổi tiền tố 84 thành 0 (+84 912… → 0912…). */
	static String normalizePhone(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String digits = value.replaceAll("\\D", "");
		return digits.startsWith("84") && digits.length() == 11 ? "0" + digits.substring(2) : digits;
	}

	static String normalizeEmail(String value) {
		return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
	}

	private Specification<Staff> specOf(ListFilter filter) {
		return (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (filter.schoolId() != null) {
				predicates.add(cb.equal(root.get("schoolId"), filter.schoolId()));
			}
			if (filter.position() != null) {
				predicates.add(cb.equal(root.get("position"), filter.position()));
			}
			if (filter.status() != null) {
				predicates.add(cb.equal(root.get("status"), filter.status()));
			}
			if (filter.q() != null && !filter.q().isBlank()) {
				String like = "%" + filter.q().trim().toLowerCase(Locale.ROOT) + "%";
				String digits = filter.q().replaceAll("\\D", "");
				List<Predicate> any = new ArrayList<>();
				any.add(cb.like(cb.lower(root.get("fullName")), like));
				any.add(cb.like(cb.lower(root.get("staffCode")), like));
				if (digits.length() >= 3) {
					any.add(cb.like(root.get("phone"), "%" + digits + "%"));
				}
				predicates.add(cb.or(any.toArray(Predicate[]::new)));
			}
			if (filter.contractExpiring()) {
				LocalDate today = LocalDate.now(clock);
				Subquery<UUID> sub = query.subquery(UUID.class);
				var c = sub.from(StaffContract.class);
				sub.select(c.get("staffId"))
					.where(cb.equal(c.get("staffId"), root.get("id")),
							cb.between(c.get("endDate"), today, today.plusDays(EXPIRY_WARNING_DAYS)));
				predicates.add(cb.exists(sub));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static Pageable sanitize(Pageable pageable) {
		for (Sort.Order order : pageable.getSort()) {
			if (!SORTABLE.contains(order.getProperty())) {
				throw ApiException.badRequest("SORT_INVALID", "Không sắp xếp được theo cột này.");
			}
		}
		Sort sort = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by("staffCode");
		return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
	}

	private Map<UUID, String> schoolNames() {
		return schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
	}

	private void requireList() {
		if (!access.canList()) {
			throw ApiException.forbidden("STAFF_FORBIDDEN", "Bạn không có quyền xem danh sách nhân sự.");
		}
	}

	private static void requireSchoolInScope(UUID schoolId) {
		if (schoolId != null && !SchoolScope.require().canAccessSchool(schoolId)) {
			throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
		}
	}

	/** Cơ sở của nhân viên mới: theo yêu cầu, không có thì cơ sở đang chọn, hoặc cơ sở duy nhất trong phạm vi. */
	private static UUID resolveSchool(UUID requested) {
		SchoolScope scope = SchoolScope.require();
		if (requested != null) {
			return requested;
		}
		if (scope.selectedSchoolId() != null) {
			return scope.selectedSchoolId();
		}
		if (scope.effectiveSchoolIds().size() == 1) {
			return scope.effectiveSchoolIds().iterator().next();
		}
		throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn cơ sở cho nhân viên.")
			.withFieldErrors(List.of(Map.of("field", "schoolId", "message", "Vui lòng chọn cơ sở")));
	}

}
