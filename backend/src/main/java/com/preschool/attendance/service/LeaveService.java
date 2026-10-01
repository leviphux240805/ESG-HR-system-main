package com.preschool.attendance.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.attendance.dto.LeaveDtos.BulkApproveResult;
import com.preschool.attendance.dto.LeaveDtos.BulkFailure;
import com.preschool.attendance.dto.LeaveDtos.CalendarEntry;
import com.preschool.attendance.dto.LeaveDtos.CreateLeaveRequest;
import com.preschool.attendance.dto.LeaveDtos.LeaveBalanceDto;
import com.preschool.attendance.dto.LeaveDtos.LeaveRequestDto;
import com.preschool.attendance.entity.AttendanceConfig;
import com.preschool.attendance.entity.LeaveBalance;
import com.preschool.attendance.entity.LeaveRequest;
import com.preschool.attendance.entity.LeaveRequest.Status;
import com.preschool.attendance.repository.LeaveBalanceRepository;
import com.preschool.attendance.repository.LeaveRequestRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.web.PageResponse;
import com.preschool.notification.service.NotificationService;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.repository.StaffRepository;
import com.preschool.staff.service.StaffService;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đơn nghỉ theo mã công. Nhân viên xin nghỉ; ban giám hiệu duyệt (đơn của hiệu trưởng do
 * hiệu trưởng duyệt). Duyệt xong ghi mã vào bảng công các ngày làm việc trong khoảng và trừ phép năm.
 */
@Service
public class LeaveService {

	static final String NOTIFY_TYPE = "LEAVE_REQUEST";

	private static final BigDecimal HALF = new BigDecimal("0.5");

	private final LeaveRequestRepository requests;

	private final LeaveBalanceRepository balances;

	private final StaffService staffService;

	private final StaffRepository staffRepo;

	private final UserRepository users;

	private final AttendanceService attendance;

	private final AttendanceConfigService configService;

	private final AttendanceAccess access;

	private final FileService fileService;

	private final NotificationService notifications;

	private final AuditService audit;

	private final Clock clock;

	public LeaveService(LeaveRequestRepository requests, LeaveBalanceRepository balances, StaffService staffService,
			StaffRepository staffRepo, UserRepository users, AttendanceService attendance,
			AttendanceConfigService configService, AttendanceAccess access, FileService fileService,
			NotificationService notifications, AuditService audit, Clock clock) {
		this.requests = requests;
		this.balances = balances;
		this.staffService = staffService;
		this.staffRepo = staffRepo;
		this.users = users;
		this.attendance = attendance;
		this.configService = configService;
		this.access = access;
		this.fileService = fileService;
		this.notifications = notifications;
		this.audit = audit;
		this.clock = clock;
	}

	// ------------------------------------------------------------ của tôi

	@Transactional
	public LeaveBalanceDto myBalance(Integer year) {
		Staff staff = staffService.find(myStaffId());
		int y = year != null ? year : LocalDate.now(clock.withZone(AttendanceConfigService.VN)).getYear();
		LeaveBalance balance = balance(staff, y);
		BigDecimal pending = requests.findByStaffIdOrderByFromDateDesc(staff.getId())
			.stream()
			.filter(r -> r.getStatus() == Status.PENDING && "P".equals(r.getLeaveCode()) && r.getFromDate().getYear() == y)
			.map(LeaveRequest::getDays)
			.reduce(BigDecimal.ZERO, BigDecimal::add);
		return new LeaveBalanceDto(y, balance.getAnnualDays(), balance.getUsedDays(), pending, balance.getRemaining());
	}

	/** Phép năm của nhân viên; chưa có thì tạo theo số ngày phép năm trong cấu hình cơ sở. */
	private LeaveBalance balance(Staff staff, int year) {
		return balances.findByStaffIdAndYear(staff.getId(), year).orElseGet(() -> {
			// TODO(assumption): phép năm mặc định theo cấu hình cơ sở (12 ngày), chưa cộng thâm niên
			AttendanceConfig config = configService.effective(staff.getSchoolId(), LocalDate.of(year, 1, 1).isAfter(
					LocalDate.now(clock.withZone(AttendanceConfigService.VN))) ? LocalDate.of(year, 1, 1)
							: LocalDate.now(clock.withZone(AttendanceConfigService.VN)));
			return balances.saveAndFlush(new LeaveBalance(staff.getSchoolId(), staff.getId(), year,
					config.getAnnualLeaveDays()));
		});
	}

	@Transactional(readOnly = true)
	public List<LeaveRequestDto> mine() {
		return toDtos(requests.findByStaffIdOrderByFromDateDesc(myStaffId()));
	}

	@Transactional
	public LeaveRequestDto create(CreateLeaveRequest r) {
		Staff staff = staffService.find(myStaffId());
		if (!staff.isActive()) {
			throw ApiException.conflict("STAFF_TERMINATED", "Hồ sơ đã nghỉ việc, không xin nghỉ được.");
		}
		if (r.toDate().isBefore(r.fromDate())) {
			throw AttendanceConfigService.fieldError("toDate", "Đến ngày phải sau từ ngày");
		}
		if (r.fromDate().plusDays(366).isBefore(r.toDate())) {
			throw AttendanceConfigService.fieldError("toDate", "Mỗi đơn tối đa một năm");
		}
		if (r.halfDay() && (!r.fromDate().equals(r.toDate()) || !Set.of("P", "K").contains(r.leaveCode()))) {
			throw AttendanceConfigService.fieldError("halfDay", "Nghỉ nửa ngày chỉ cho phép năm hoặc không lương trong một ngày");
		}
		BigDecimal days = r.halfDay() ? HALF
				: workingDays(staff.getSchoolId(), r.fromDate(), r.toDate()).values()
					.stream()
					.reduce(BigDecimal.ZERO, BigDecimal::add);
		if (days.signum() == 0) {
			throw AttendanceConfigService.fieldError("fromDate", "Khoảng ngày không có ngày làm việc");
		}
		if (!requests.findOverlapping(staff.getId(), r.fromDate(), r.toDate(), List.of(Status.PENDING, Status.APPROVED))
			.isEmpty()) {
			throw ApiException.conflict("LEAVE_OVERLAP", "Đã có đơn nghỉ khác trùng ngày.")
				.withFieldErrors(List.of(Map.of("field", "fromDate", "message", "trùng ngày với đơn nghỉ khác")));
		}
		requireMonthsUnlocked(staff.getSchoolId(), r.fromDate(), r.toDate());
		if ("P".equals(r.leaveCode())) {
			LeaveBalanceDto balance = myBalance(r.fromDate().getYear());
			if (balance.remaining().subtract(balance.pendingDays()).compareTo(days) < 0) {
				throw ApiException.badRequest("LEAVE_BALANCE", "Không đủ ngày phép năm (còn %s ngày, đang chờ duyệt %s ngày)."
					.formatted(balance.remaining().stripTrailingZeros().toPlainString(),
							balance.pendingDays().stripTrailingZeros().toPlainString()));
			}
		}
		UUID fileId = null;
		if (r.fileId() != null) {
			fileId = fileService.requireAttachable(r.fileId()).getId();
		}
		LeaveRequest request = requests.saveAndFlush(new LeaveRequest(staff.getSchoolId(), staff.getId(), r.leaveCode(),
				r.fromDate(), r.toDate(), r.halfDay(), days, r.reason().trim(), fileId));
		audit.record("leave.request", request.getId(), Action.CREATE, null, snapshot(request));
		String title = "%s xin nghỉ %s (%s)".formatted(staff.getFullName(), request.attendanceCode(), range(request));
		for (User approver : approvers(staff)) {
			notifications.notify(approver.getId(), NOTIFY_TYPE, title, r.reason().trim(), "/nghi-phep?tab=cho-duyet",
					"leave:" + request.getId());
		}
		return toDtos(List.of(request)).getFirst();
	}

	@Transactional
	public LeaveRequestDto cancel(UUID id) {
		LeaveRequest request = requests.findById(id).filter(r -> r.getStaffId().equals(myStaffId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn nghỉ."));
		if (request.getStatus() != Status.PENDING) {
			throw ApiException.conflict("LEAVE_NOT_PENDING", "Chỉ hủy được đơn đang chờ duyệt.");
		}
		request.cancel();
		audit.record("leave.request", id, Action.UPDATE, Map.of("status", "PENDING"), Map.of("status", "CANCELLED"));
		return toDtos(List.of(request)).getFirst();
	}

	// ------------------------------------------------------------ duyệt

	@Transactional(readOnly = true)
	public PageResponse<LeaveRequestDto> list(Status status, Pageable pageable) {
		List<LeaveRequest> all = status == Status.PENDING ? requests.findByStatusOrderByFromDateAsc(status)
				: requests.findAllByOrderByCreatedAtDesc().stream().filter(r -> status == null || r.getStatus() == status)
					.toList();
		Map<UUID, Boolean> principalCache = new java.util.HashMap<>();
		List<LeaveRequest> visible = all.stream()
			.filter(r -> access.canManage(r.getSchoolId()) || access.canView(r.getSchoolId()))
			.filter(r -> status != Status.PENDING || canReview(r, principalCache))
			.toList();
		int from = (int) Math.min(pageable.getOffset(), visible.size());
		int to = Math.min(from + pageable.getPageSize(), visible.size());
		return new PageResponse<>(toDtos(visible.subList(from, to)), pageable.getPageNumber(), pageable.getPageSize(),
				visible.size(), (int) Math.ceil(visible.size() / (double) pageable.getPageSize()));
	}

	@Transactional
	public LeaveRequestDto approve(UUID id, String note) {
		LeaveRequest request = findReviewable(id);
		approveOne(request, note);
		return toDtos(List.of(request)).getFirst();
	}

	@Transactional
	public BulkApproveResult approveMany(List<UUID> ids, String note) {
		int approved = 0;
		List<BulkFailure> failed = new ArrayList<>();
		for (UUID id : ids) {
			try {
				// Kiểm tra hết trước khi ghi, nên lỗi của một đơn không để lại dữ liệu dở
				approveOne(findReviewable(id), note);
				approved++;
			}
			catch (ApiException ex) {
				failed.add(new BulkFailure(id, ex.getMessage()));
			}
		}
		return new BulkApproveResult(approved, failed);
	}

	private void approveOne(LeaveRequest request, String note) {
		requireMonthsUnlocked(request.getSchoolId(), request.getFromDate(), request.getToDate());
		Staff staff = staffRepo.findById(request.getStaffId())
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy nhân viên."));
		Map<LocalDate, BigDecimal> days = workingDays(request.getSchoolId(), request.getFromDate(), request.getToDate());
		LeaveBalance balance = "P".equals(request.getLeaveCode()) ? balance(staff, request.getFromDate().getYear()) : null;
		UUID approver = SchoolScope.require().userId();
		for (LocalDate day : days.keySet()) {
			attendance.writeLeaveCode(request.getSchoolId(), request.getStaffId(), day, request.attendanceCode(), approver);
		}
		if (balance != null) {
			balance.use(request.getDays());
		}
		request.review(Status.APPROVED, approver, Instant.now(clock), blankToNull(note));
		audit.record("leave.request", request.getId(), Action.UPDATE, Map.of("status", "PENDING"),
				Map.of("status", "APPROVED", "days", request.getDays()));
		notifyRequester(request, "Đơn nghỉ %s (%s) đã được duyệt".formatted(request.attendanceCode(), range(request)),
				note);
	}

	@Transactional
	public LeaveRequestDto reject(UUID id, String note) {
		LeaveRequest request = findReviewable(id);
		request.review(Status.REJECTED, SchoolScope.require().userId(), Instant.now(clock), note.trim());
		audit.record("leave.request", id, Action.UPDATE, Map.of("status", "PENDING"),
				Map.of("status", "REJECTED", "note", note.trim()));
		notifyRequester(request, "Đơn nghỉ %s (%s) bị từ chối".formatted(request.attendanceCode(), range(request)), note);
		return toDtos(List.of(request)).getFirst();
	}

	@Transactional(readOnly = true)
	public List<CalendarEntry> calendar(String monthValue) {
		YearMonth month = AttendanceService.parseMonth(monthValue);
		UUID schoolId = AttendanceService.currentSchool();
		access.requireView(schoolId);
		List<LeaveRequest> list = requests.findInRange(Status.APPROVED, month.atDay(1), month.atEndOfMonth())
			.stream()
			.filter(r -> r.getSchoolId().equals(schoolId))
			.toList();
		Map<UUID, Staff> staff = staffById(list);
		return list.stream()
			.map(r -> new CalendarEntry(r.getId(), r.getStaffId(), nameOf(staff, r.getStaffId()), r.attendanceCode(),
					r.getFromDate(), r.getToDate()))
			.toList();
	}

	@Transactional(readOnly = true)
	public DownloadUrlResponse fileUrl(UUID id) {
		LeaveRequest request = requests.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn nghỉ."));
		boolean own = request.getStaffId().equals(SchoolScope.require().access().staffId());
		if (!own && !access.canView(request.getSchoolId())) {
			throw ApiException.notFound("Không tìm thấy đơn nghỉ.");
		}
		if (request.getFileId() == null) {
			throw ApiException.notFound("Đơn không có tệp đính kèm.");
		}
		StoredFile file = fileService.findForModule(List.of(request.getFileId())).get(request.getFileId());
		if (file == null) {
			throw ApiException.notFound("Không tìm thấy tệp.");
		}
		return fileService.presignDownload(file, true);
	}

	// ------------------------------------------------------------ hỗ trợ

	/**
	 * Ngày làm việc trong khoảng theo cấu hình cơ sở: bỏ ngày nghỉ tuần và ngày lễ; ngày làm nửa buổi tính 0,5.
	 */
	Map<LocalDate, BigDecimal> workingDays(UUID schoolId, LocalDate from, LocalDate to) {
		AttendanceConfig config = configService.effective(schoolId, from);
		Set<DayOfWeek> working = config.getWorkingWeekdays();
		Set<DayOfWeek> halfDay = config.getHalfDayWeekdays();
		Set<LocalDate> holidays = configService.holidayNames(schoolId, from, to).keySet();
		Map<LocalDate, BigDecimal> result = new LinkedHashMap<>();
		for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
			if (working.contains(d.getDayOfWeek()) && !holidays.contains(d)) {
				result.put(d, halfDay.contains(d.getDayOfWeek()) ? HALF : BigDecimal.ONE);
			}
		}
		return result;
	}

	private void requireMonthsUnlocked(UUID schoolId, LocalDate from, LocalDate to) {
		for (YearMonth m = YearMonth.from(from); !m.isAfter(YearMonth.from(to)); m = m.plusMonths(1)) {
			attendance.requireUnlocked(schoolId, m);
		}
	}

	private LeaveRequest findReviewable(UUID id) {
		LeaveRequest request = requests.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn nghỉ."));
		if (!canReview(request, new java.util.HashMap<>())) {
			throw ApiException.forbidden("LEAVE_FORBIDDEN", "Bạn không có quyền duyệt đơn nghỉ này.");
		}
		if (request.getStatus() != Status.PENDING) {
			throw ApiException.conflict("LEAVE_NOT_PENDING", "Đơn nghỉ đã được xử lý.");
		}
		return request;
	}

	/**
	 * Người duyệt: hiệu trưởng hoặc phó hiệu trưởng nhóm Nhân sự của trường, không tự duyệt đơn của mình. Đơn của ban
	 * giám hiệu (hiệu trưởng, phó hiệu trưởng) do hiệu trưởng của trường duyệt.
	 * TODO(assumption): hiệu trưởng tự duyệt đơn của mình khi trường không có hiệu trưởng khác.
	 */
	private boolean canReview(LeaveRequest request, Map<UUID, Boolean> leaderCache) {
		UUID schoolId = request.getSchoolId();
		boolean requesterIsLeader = leaderCache.computeIfAbsent(request.getStaffId(),
				staffId -> users.findByStaffId(staffId).map(u -> isLeaderAt(u, schoolId)).orElse(false));
		if (requesterIsLeader) {
			return access.isPrincipalAt(schoolId);
		}
		return access.canManage(schoolId) && !request.getStaffId().equals(SchoolScope.require().access().staffId());
	}

	private static boolean isLeaderAt(User user, UUID schoolId) {
		return user.getRoles()
			.stream()
			.anyMatch(r -> r.getSchoolId().equals(schoolId)
					&& (r.getRoleCode() == RoleCode.PRINCIPAL || r.getRoleCode() == RoleCode.VICE_PRINCIPAL));
	}

	private List<User> approvers(Staff staff) {
		Set<User> result = new java.util.LinkedHashSet<>(users.findActiveByRole(RoleCode.PRINCIPAL, staff.getSchoolId()));
		boolean isLeader = users.findByStaffId(staff.getId()).map(u -> isLeaderAt(u, staff.getSchoolId())).orElse(false);
		if (!isLeader) {
			users.findActiveByRole(RoleCode.VICE_PRINCIPAL, staff.getSchoolId())
				.stream()
				.filter(u -> u.getRoles()
					.stream()
					.anyMatch(r -> r.getRoleCode() == RoleCode.VICE_PRINCIPAL && r.getSchoolId().equals(staff.getSchoolId())
							&& r.getFunctionGroups().contains(FunctionGroup.HR)))
				.forEach(result::add);
		}
		return new ArrayList<>(result);
	}

	private void notifyRequester(LeaveRequest request, String title, String note) {
		users.findByStaffId(request.getStaffId()).ifPresent(user -> notifications.notify(user.getId(), NOTIFY_TYPE, title,
				blankToNull(note), "/nghi-phep", "leave-result:" + request.getId()));
	}

	private static UUID myStaffId() {
		UUID staffId = SchoolScope.require().access().staffId();
		if (staffId == null) {
			throw ApiException.notFound("Tài khoản của bạn chưa được gắn với hồ sơ nhân viên.");
		}
		return staffId;
	}

	private static String range(LeaveRequest r) {
		java.time.format.DateTimeFormatter f = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
		return r.getFromDate().equals(r.getToDate()) ? f.format(r.getFromDate())
				: f.format(r.getFromDate()) + " – " + f.format(r.getToDate());
	}

	private static Map<String, Object> snapshot(LeaveRequest r) {
		Map<String, Object> map = new LinkedHashMap<>();
		map.put("code", r.attendanceCode());
		map.put("from", r.getFromDate().toString());
		map.put("to", r.getToDate().toString());
		map.put("days", r.getDays());
		map.put("status", r.getStatus().name());
		return map;
	}

	private Map<UUID, Staff> staffById(List<LeaveRequest> list) {
		return staffRepo.findAllById(list.stream().map(LeaveRequest::getStaffId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Staff::getId, Function.identity()));
	}

	private static String nameOf(Map<UUID, Staff> staff, UUID id) {
		Staff s = staff.get(id);
		return s == null ? "" : s.getFullName();
	}

	private List<LeaveRequestDto> toDtos(List<LeaveRequest> list) {
		Map<UUID, Staff> staff = staffById(list);
		Map<UUID, String> reviewers = users.findAllById(list.stream().map(LeaveRequest::getReviewedBy)
			.filter(Objects::nonNull).distinct().toList())
			.stream()
			.collect(Collectors.toMap(User::getId, User::getFullName));
		Map<UUID, StoredFile> files = fileService.findForModule(list.stream().map(LeaveRequest::getFileId)
			.filter(Objects::nonNull).distinct().toList());
		UUID me = SchoolScope.require().access().staffId();
		Map<UUID, Boolean> principalCache = new java.util.HashMap<>();
		return list.stream()
			.map(r -> {
				Staff s = staff.get(r.getStaffId());
				StoredFile f = r.getFileId() == null ? null : files.get(r.getFileId());
				boolean pending = r.getStatus() == Status.PENDING;
				return new LeaveRequestDto(r.getId(), r.getStaffId(), s == null ? "" : s.getStaffCode(),
						s == null ? "" : s.getFullName(), r.getSchoolId(), r.getLeaveCode(), r.attendanceCode(),
						r.getFromDate(), r.getToDate(), r.isHalfDay(), r.getDays(), r.getReason(),
						f == null ? null : new FileRef(f.getId(), f.getOriginalName(), f.getMimeType(), f.getSizeBytes()),
						r.getStatus(), reviewers.get(r.getReviewedBy()), r.getReviewedAt(), r.getReviewNote(),
						r.getCreatedAt(), pending && canReview(r, principalCache),
						pending && r.getStaffId().equals(me));
			})
			.toList();
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
