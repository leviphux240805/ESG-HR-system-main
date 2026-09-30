package com.preschool.staff.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.web.PageResponse;
import com.preschool.notification.service.NotificationService;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.ChangeRequestDtos;
import com.preschool.staff.dto.ChangeRequestDtos.ChangeRequestDto;
import com.preschool.staff.dto.ChangeRequestDtos.FieldChange;
import com.preschool.staff.dto.ChangeRequestDtos.Kind;
import com.preschool.staff.dto.StaffDtos.BankInfo;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffChangeRequest;
import com.preschool.staff.entity.StaffEnums.ChangeRequestStatus;
import com.preschool.staff.mapper.StaffMapper;
import com.preschool.staff.repository.StaffChangeRequestRepository;
import com.preschool.staff.repository.StaffRepository;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Nhân viên tự đề xuất cập nhật hồ sơ; người có quyền duyệt thì thay đổi mới được ghi vào hồ sơ. Liên hệ (SĐT, địa
 * chỉ): hiệu trưởng cơ sở hoặc văn phòng điều hành duyệt. Ngân hàng: văn phòng điều hành hoặc kế toán duyệt.
 */
@Service
public class StaffChangeRequestService {

	static final String NOTIFY_TYPE = "STAFF_CHANGE_REQUEST";

	private static final Map<String, Function<Staff, String>> GETTERS = Map.ofEntries(
			Map.entry("phone", Staff::getPhone), Map.entry("permProvinceCode", Staff::getPermProvinceCode),
			Map.entry("permWardCode", Staff::getPermWardCode), Map.entry("permAddressDetail", Staff::getPermAddressDetail),
			Map.entry("currProvinceCode", Staff::getCurrProvinceCode), Map.entry("currWardCode", Staff::getCurrWardCode),
			Map.entry("currAddressDetail", Staff::getCurrAddressDetail), Map.entry("bankName", Staff::getBankName),
			Map.entry("bankAccountNo", Staff::getBankAccountNo),
			Map.entry("bankAccountHolder", Staff::getBankAccountHolder));

	private static final Map<String, BiConsumer<Staff, String>> SETTERS = Map.ofEntries(
			Map.entry("phone", Staff::setPhone), Map.entry("permProvinceCode", Staff::setPermProvinceCode),
			Map.entry("permWardCode", Staff::setPermWardCode), Map.entry("permAddressDetail", Staff::setPermAddressDetail),
			Map.entry("currProvinceCode", Staff::setCurrProvinceCode), Map.entry("currWardCode", Staff::setCurrWardCode),
			Map.entry("currAddressDetail", Staff::setCurrAddressDetail), Map.entry("bankName", Staff::setBankName),
			Map.entry("bankAccountNo", Staff::setBankAccountNo),
			Map.entry("bankAccountHolder", Staff::setBankAccountHolder));

	private static final Map<String, Integer> MAX_LENGTH = Map.of("phone", 20, "permProvinceCode", 5, "permWardCode", 10,
			"currProvinceCode", 5, "currWardCode", 10, "bankName", 100, "bankAccountNo", 30, "bankAccountHolder", 200);

	private final StaffChangeRequestRepository requests;

	private final StaffRepository staffRepo;

	private final StaffService staffService;

	private final StaffMapper mapper;

	private final UserRepository users;

	private final SchoolRepository schools;

	private final NotificationService notifications;

	private final AuditService audit;

	private final JsonMapper jsonMapper;

	private final Clock clock;

	public StaffChangeRequestService(StaffChangeRequestRepository requests, StaffRepository staffRepo,
			StaffService staffService, StaffMapper mapper, UserRepository users, SchoolRepository schools,
			NotificationService notifications, AuditService audit, JsonMapper jsonMapper, Clock clock) {
		this.requests = requests;
		this.staffRepo = staffRepo;
		this.staffService = staffService;
		this.mapper = mapper;
		this.users = users;
		this.schools = schools;
		this.notifications = notifications;
		this.audit = audit;
		this.jsonMapper = jsonMapper;
		this.clock = clock;
	}

	// ------------------------------------------------------------ của tôi

	/** Hồ sơ nhân viên gắn với tài khoản đang đăng nhập. */
	@Transactional(readOnly = true)
	public StaffDetail myProfile() {
		return staffService.get(myStaffId());
	}

	@Transactional(readOnly = true)
	public List<ChangeRequestDto> mine() {
		return toDtos(requests.findByStaffIdOrderByCreatedAtDesc(myStaffId()));
	}

	@Transactional
	public ChangeRequestDto submit(Map<String, String> changes) {
		Staff staff = staffService.find(myStaffId());
		if (!staff.isActive()) {
			throw ApiException.conflict("STAFF_TERMINATED", "Hồ sơ đã nghỉ việc, không gửi đề xuất được.");
		}
		Kind kind = kindOf(changes.keySet());
		Map<String, Map<String, String>> diff = new LinkedHashMap<>();
		changes.forEach((field, raw) -> {
			String value = clean(field, raw);
			String current = GETTERS.get(field).apply(staff);
			if (!Objects.equals(value, current)) {
				Map<String, String> change = new LinkedHashMap<>();
				change.put("from", current);
				change.put("to", value);
				diff.put(field, change);
			}
		});
		if (diff.isEmpty()) {
			throw ApiException.badRequest("NO_CHANGES", "Thông tin đề xuất giống hồ sơ hiện tại.");
		}
		if (diff.containsKey("phone") && diff.get("phone").get("to") != null
				&& staffRepo.phoneTakenAnywhere(diff.get("phone").get("to"), staff.getId())) {
			throw fieldError("phone", "số điện thoại đã có trong hồ sơ nhân viên khác");
		}
		boolean pendingSameKind = requests.findByStaffIdAndStatus(staff.getId(), ChangeRequestStatus.PENDING).stream()
			.anyMatch(r -> kindOf(parse(r).keySet()) == kind);
		if (pendingSameKind) {
			throw ApiException.conflict("CHANGE_REQUEST_PENDING",
					"Bạn đã có đề xuất " + label(kind) + " đang chờ duyệt. Vui lòng chờ kết quả trước khi gửi đề xuất mới.");
		}
		StaffChangeRequest request = requests.saveAndFlush(new StaffChangeRequest(staff.getId(), staff.getSchoolId(),
				jsonMapper.writeValueAsString(diff)));
		for (User reviewer : reviewers(kind, staff.getSchoolId())) {
			notifications.notify(reviewer.getId(), NOTIFY_TYPE,
					"%s đề xuất cập nhật %s".formatted(staff.getFullName(), label(kind)), "Mã nhân viên " + staff.getStaffCode(),
					"/nhan-su/de-xuat", "change-request:" + request.getId());
		}
		return toDtos(List.of(request)).getFirst();
	}

	// ------------------------------------------------------------ duyệt

	/** Đề xuất trong phạm vi cơ sở đang chọn mà người xem được duyệt; {@code status} rỗng = mọi trạng thái. */
	@Transactional(readOnly = true)
	public PageResponse<ChangeRequestDto> list(ChangeRequestStatus status, Pageable pageable) {
		List<StaffChangeRequest> all = status == ChangeRequestStatus.PENDING
				? requests.findByStatusOrderByCreatedAtAsc(status)
				: requests.findAllByOrderByCreatedAtDesc().stream().filter(r -> status == null || r.getStatus() == status)
					.toList();
		List<StaffChangeRequest> reviewable = all.stream().filter(r -> canReview(kindOf(parse(r).keySet()), r.getSchoolId()))
			.toList();
		int from = (int) Math.min(pageable.getOffset(), reviewable.size());
		int to = Math.min(from + pageable.getPageSize(), reviewable.size());
		return new PageResponse<>(toDtos(reviewable.subList(from, to)), pageable.getPageNumber(),
				pageable.getPageSize(), reviewable.size(),
				(int) Math.ceil(reviewable.size() / (double) pageable.getPageSize()));
	}

	@Transactional
	public ChangeRequestDto approve(UUID id, String note) {
		StaffChangeRequest request = findReviewable(id);
		Staff staff = staffService.find(request.getStaffId());
		Map<String, Map<String, String>> diff = parse(request);
		Kind kind = kindOf(diff.keySet());
		Object before = kind == Kind.BANK ? bankOf(staff) : mapper.toFields(staff);
		diff.forEach((field, change) -> SETTERS.get(field).accept(staff, change.get("to")));
		if (staff.getPhone() != null && staffRepo.phoneTakenAnywhere(staff.getPhone(), staff.getId())) {
			throw ApiException.conflict("STAFF_DUPLICATE",
					"Số điện thoại đề xuất đã có trong hồ sơ nhân viên khác, không duyệt được.");
		}
		audit.record(kind == Kind.BANK ? "staff.bank" : "staff", staff.getId(), Action.UPDATE, before,
				kind == Kind.BANK ? bankOf(staff) : mapper.toFields(staff));
		request.review(ChangeRequestStatus.APPROVED, SchoolScope.require().userId(), Instant.now(clock), blankToNull(note));
		notifyRequester(staff, kind, "Đề xuất cập nhật %s đã được duyệt".formatted(label(kind)), note, request);
		return toDtos(List.of(request)).getFirst();
	}

	@Transactional
	public ChangeRequestDto reject(UUID id, String note) {
		StaffChangeRequest request = findReviewable(id);
		Staff staff = staffService.find(request.getStaffId());
		Kind kind = kindOf(parse(request).keySet());
		request.review(ChangeRequestStatus.REJECTED, SchoolScope.require().userId(), Instant.now(clock), note.trim());
		notifyRequester(staff, kind, "Đề xuất cập nhật %s bị từ chối".formatted(label(kind)), note, request);
		return toDtos(List.of(request)).getFirst();
	}

	// ------------------------------------------------------------ hỗ trợ

	private StaffChangeRequest findReviewable(UUID id) {
		StaffChangeRequest request = requests.findById(id)
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy đề xuất."));
		if (!canReview(kindOf(parse(request).keySet()), request.getSchoolId())) {
			throw ApiException.forbidden("CHANGE_REQUEST_FORBIDDEN", "Bạn không có quyền duyệt đề xuất này.");
		}
		if (request.getStatus() != ChangeRequestStatus.PENDING) {
			throw ApiException.conflict("CHANGE_REQUEST_REVIEWED", "Đề xuất đã được xử lý.");
		}
		return request;
	}

	/** Quyền duyệt theo quyết định giai đoạn 2 (không kể người gửi tự duyệt). */
	boolean canReview(Kind kind, UUID schoolId) {
		SchoolScope scope = SchoolScope.require();
		return switch (kind) {
			case CONTACT -> scope.hasRoleAt(RoleCode.PRINCIPAL, schoolId) || scope.hasRoleAt(RoleCode.CHAIN_ADMIN, schoolId);
			case BANK -> scope.hasRoleAt(RoleCode.CHAIN_ADMIN, schoolId) || scope.hasRoleAt(RoleCode.ACCOUNTANT, schoolId);
		};
	}

	private List<User> reviewers(Kind kind, UUID schoolId) {
		Set<User> result = new LinkedHashSet<>(users.findActiveByRole(RoleCode.CHAIN_ADMIN, null));
		if (kind == Kind.CONTACT) {
			result.addAll(users.findActiveByRole(RoleCode.PRINCIPAL, schoolId));
		}
		else {
			result.addAll(users.findActiveByRole(RoleCode.ACCOUNTANT, schoolId));
			result.addAll(users.findActiveByRole(RoleCode.ACCOUNTANT, null));
		}
		return new ArrayList<>(result);
	}

	private void notifyRequester(Staff staff, Kind kind, String title, String note, StaffChangeRequest request) {
		users.findByStaffId(staff.getId()).ifPresent(user -> notifications.notify(user.getId(), NOTIFY_TYPE, title,
				blankToNull(note), "/cua-toi/ho-so", "change-request-result:" + request.getId()));
	}

	private static UUID myStaffId() {
		UUID staffId = SchoolScope.require().access().staffId();
		if (staffId == null) {
			throw ApiException.notFound("Tài khoản của bạn chưa được gắn với hồ sơ nhân viên.");
		}
		return staffId;
	}

	private static Kind kindOf(Set<String> fields) {
		boolean contact = fields.stream().anyMatch(ChangeRequestDtos.CONTACT_FIELDS::contains);
		boolean bank = fields.stream().anyMatch(ChangeRequestDtos.BANK_FIELDS::contains);
		for (String field : fields) {
			if (!GETTERS.containsKey(field)) {
				throw fieldError("changes", "Không đề xuất được trường " + field);
			}
		}
		if (contact && bank) {
			throw fieldError("changes", "Gửi riêng đề xuất liên hệ và đề xuất tài khoản ngân hàng");
		}
		return bank ? Kind.BANK : Kind.CONTACT;
	}

	private static String clean(String field, String raw) {
		String value = blankToNull(raw);
		if (value == null) {
			return null;
		}
		if (field.equals("phone")) {
			value = StaffService.normalizePhone(value);
			if (!value.matches("^[0-9]{9,15}$")) {
				throw fieldError("phone", "số điện thoại không hợp lệ");
			}
		}
		if (field.equals("bankAccountNo") && !value.matches("^[0-9]{6,30}$")) {
			throw fieldError("bankAccountNo", "số tài khoản chỉ gồm chữ số");
		}
		int max = MAX_LENGTH.getOrDefault(field, 300);
		if (value.length() > max) {
			throw fieldError(field, "tối đa " + max + " ký tự");
		}
		return value;
	}

	private static String label(Kind kind) {
		return kind == Kind.BANK ? "tài khoản ngân hàng" : "thông tin liên hệ";
	}

	private static BankInfo bankOf(Staff s) {
		return new BankInfo(s.getBankName(), s.getBankAccountNo(), s.getBankAccountHolder());
	}

	private Map<String, Map<String, String>> parse(StaffChangeRequest request) {
		return jsonMapper.readValue(request.getChanges(), new TypeReference<LinkedHashMap<String, Map<String, String>>>() {
		});
	}

	private List<ChangeRequestDto> toDtos(List<StaffChangeRequest> list) {
		Map<UUID, Staff> staff = staffRepo.findAllById(list.stream().map(StaffChangeRequest::getStaffId).distinct().toList())
			.stream().collect(Collectors.toMap(Staff::getId, Function.identity()));
		Map<UUID, String> reviewers = users.findAllById(list.stream().map(StaffChangeRequest::getReviewedBy)
			.filter(Objects::nonNull).distinct().toList())
			.stream().collect(Collectors.toMap(User::getId, User::getFullName));
		Map<UUID, String> schoolNames = schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
		List<ChangeRequestDto> result = new ArrayList<>();
		for (StaffChangeRequest r : list) {
			Map<String, Map<String, String>> diff = parse(r);
			Kind kind = kindOf(diff.keySet());
			Staff s = staff.get(r.getStaffId());
			List<FieldChange> changes = diff.entrySet().stream()
				.map(e -> new FieldChange(e.getKey(), e.getValue().get("from"), e.getValue().get("to"))).toList();
			result.add(new ChangeRequestDto(r.getId(), r.getStaffId(), s == null ? "" : s.getStaffCode(),
					s == null ? "" : s.getFullName(), r.getSchoolId(), schoolNames.get(r.getSchoolId()), kind, changes,
					r.getStatus(), r.getCreatedAt(), r.getReviewedAt(), reviewers.get(r.getReviewedBy()),
					r.getReviewNote(), r.getStatus() == ChangeRequestStatus.PENDING && canReview(kind, r.getSchoolId())));
		}
		return result;
	}

	private static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_FAILED", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
