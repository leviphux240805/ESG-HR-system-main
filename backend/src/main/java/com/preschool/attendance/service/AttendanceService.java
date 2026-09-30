package com.preschool.attendance.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.attendance.dto.AttendanceDtos.Cell;
import com.preschool.attendance.dto.AttendanceDtos.CellDetail;
import com.preschool.attendance.dto.AttendanceDtos.DayInfo;
import com.preschool.attendance.dto.AttendanceDtos.DiscrepancyItem;
import com.preschool.attendance.dto.AttendanceDtos.ImportRequest;
import com.preschool.attendance.dto.AttendanceDtos.ImportResult;
import com.preschool.attendance.dto.AttendanceDtos.ImportRow;
import com.preschool.attendance.dto.AttendanceDtos.LockInfo;
import com.preschool.attendance.dto.AttendanceDtos.MonthSheet;
import com.preschool.attendance.dto.AttendanceDtos.MySheet;
import com.preschool.attendance.dto.AttendanceDtos.ResolveItem;
import com.preschool.attendance.dto.AttendanceDtos.ResolveRequest;
import com.preschool.attendance.dto.AttendanceDtos.StaffRow;
import com.preschool.attendance.dto.AttendanceDtos.Totals;
import com.preschool.attendance.dto.AttendanceDtos.UnmatchedCode;
import com.preschool.attendance.dto.AttendanceDtos.UpdateCellRequest;
import com.preschool.attendance.engine.AttendanceReconciler;
import com.preschool.attendance.engine.AttendanceReconciler.DayResult;
import com.preschool.attendance.engine.AttendanceReconciler.Mark;
import com.preschool.attendance.engine.AttendanceReconciler.Punch;
import com.preschool.attendance.engine.MonthTotals;
import com.preschool.attendance.entity.AttendanceConfig;
import com.preschool.attendance.entity.AttendanceImportBatch;
import com.preschool.attendance.entity.AttendancePunch;
import com.preschool.attendance.entity.StaffAttendanceDay;
import com.preschool.attendance.entity.StaffAttendanceDay.Source;
import com.preschool.attendance.repository.AttendanceImportBatchRepository;
import com.preschool.attendance.repository.AttendanceMonthLockRepository;
import com.preschool.attendance.repository.AttendancePunchRepository;
import com.preschool.attendance.repository.StaffAttendanceDayRepository;
import com.preschool.attendance.service.AttendanceRoster.Member;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileService;
import com.preschool.security.SchoolScope;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.repository.StaffRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bảng công tháng của cơ sở: xem lưới, sửa ô, import dữ liệu máy chấm công (frontend đã đọc file Excel), đối soát
 * bằng {@link AttendanceReconciler}, xử lý sai lệch. Cơ sở lấy theo cơ sở đang chọn trên header.
 */
@Service
public class AttendanceService {

	private final AttendanceRoster roster;

	private final StaffAttendanceDayRepository days;

	private final AttendancePunchRepository punches;

	private final AttendanceImportBatchRepository batches;

	private final AttendanceMonthLockRepository locks;

	private final AttendanceConfigService configService;

	private final AttendanceAccess access;

	private final FileService fileService;

	private final UserRepository users;

	private final StaffRepository staffRepo;

	private final AuditService audit;

	public AttendanceService(AttendanceRoster roster, StaffAttendanceDayRepository days,
			AttendancePunchRepository punches, AttendanceImportBatchRepository batches,
			AttendanceMonthLockRepository locks, AttendanceConfigService configService, AttendanceAccess access,
			FileService fileService, UserRepository users, StaffRepository staffRepo, AuditService audit) {
		this.roster = roster;
		this.days = days;
		this.punches = punches;
		this.batches = batches;
		this.locks = locks;
		this.configService = configService;
		this.access = access;
		this.fileService = fileService;
		this.users = users;
		this.staffRepo = staffRepo;
		this.audit = audit;
	}

	// ------------------------------------------------------------ hỗ trợ chung

	public static YearMonth parseMonth(String value) {
		try {
			return YearMonth.parse(value);
		}
		catch (DateTimeParseException | NullPointerException ex) {
			throw ApiException.badRequest("MONTH_INVALID", "Tháng không hợp lệ (dạng yyyy-MM).");
		}
	}

	/** Cơ sở đang chọn; cấp chuỗi đang xem "Tất cả cơ sở" phải chọn một cơ sở. */
	public static UUID currentSchool() {
		SchoolScope scope = SchoolScope.require();
		if (scope.selectedSchoolId() != null) {
			return scope.selectedSchoolId();
		}
		Set<UUID> schools = scope.effectiveSchoolIds();
		if (schools.size() == 1) {
			return schools.iterator().next();
		}
		throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn một cơ sở trên đầu trang.");
	}

	public boolean isLocked(UUID schoolId, YearMonth month) {
		return locks.existsBySchoolIdAndMonth(schoolId, month.atDay(1));
	}

	/** Tháng đã khóa công thì không ghi gì vào bảng công (sửa ô, import, xử lý sai lệch, duyệt nghỉ). */
	public void requireUnlocked(UUID schoolId, YearMonth month) {
		if (isLocked(schoolId, month)) {
			throw ApiException.conflict("ATTENDANCE_MONTH_LOCKED",
					"Công tháng %d/%d đã khóa, không sửa được.".formatted(month.getMonthValue(), month.getYear()));
		}
	}

	private static String key(UUID staffId, LocalDate date) {
		return staffId + "|" + date;
	}

	private Member member(UUID schoolId, UUID staffId, LocalDate date) {
		return roster.members(schoolId, YearMonth.from(date))
			.stream()
			.filter(m -> m.staffId().equals(staffId) && m.covers(date))
			.findFirst()
			.orElseThrow(() -> ApiException.notFound("Nhân viên không thuộc bảng công của cơ sở vào ngày này."));
	}

	private static String validCode(String code) {
		if (code == null || code.isBlank()) {
			return null;
		}
		String value = code.trim().toUpperCase(Locale.ROOT);
		if (!AttendanceReconciler.CODES.contains(value)) {
			throw AttendanceConfigService.fieldError("code", "Mã công không hợp lệ: " + code);
		}
		return value;
	}

	// ------------------------------------------------------------ bảng công tháng

	@Transactional(readOnly = true)
	public MonthSheet sheet(String monthValue) {
		YearMonth month = parseMonth(monthValue);
		UUID schoolId = currentSchool();
		access.requireView(schoolId);
		LocalDate first = month.atDay(1);
		LocalDate last = month.atEndOfMonth();

		AttendanceConfig config = configService.effective(schoolId, first);
		Set<DayOfWeek> working = config.getWorkingWeekdays();
		Set<DayOfWeek> halfDay = config.getHalfDayWeekdays();
		Map<LocalDate, String> holidays = configService.holidayNames(schoolId, first, last);

		List<DayInfo> dayInfos = new ArrayList<>();
		for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
			dayInfos.add(new DayInfo(d, d.getDayOfWeek().getValue(), holidays.get(d), working.contains(d.getDayOfWeek()),
					halfDay.contains(d.getDayOfWeek())));
		}

		Map<UUID, List<StaffAttendanceDay>> rowsByStaff = days.findBySchoolIdAndWorkDateBetween(schoolId, first, last)
			.stream()
			.collect(Collectors.groupingBy(StaffAttendanceDay::getStaffId));
		List<StaffRow> staffRows = new ArrayList<>();
		int discrepancies = 0;
		for (Member m : roster.members(schoolId, month)) {
			Map<String, Cell> cells = new LinkedHashMap<>();
			Map<LocalDate, String> codes = new HashMap<>();
			int late = 0;
			for (StaffAttendanceDay row : rowsByStaff.getOrDefault(m.staffId(), List.of())) {
				if (!m.covers(row.getWorkDate())) {
					continue;
				}
				cells.put(row.getWorkDate().toString(), new Cell(row.getStatusCode(), row.getSource().name(),
						row.isDiscrepancy(), row.getLateMinutes(), row.isCountedLate(), row.getNote()));
				if (row.getStatusCode() != null) {
					codes.put(row.getWorkDate(), row.getStatusCode());
				}
				late += row.isCountedLate() ? 1 : 0;
				discrepancies += row.isDiscrepancy() ? 1 : 0;
			}
			Set<LocalDate> memberHolidays = holidays.keySet().stream().filter(m::covers).collect(Collectors.toSet());
			MonthTotals t = MonthTotals.compute(month, codes, memberHolidays, working, late);
			staffRows.add(new StaffRow(m.staffId(), m.staffCode(), m.fullName(), m.position(), m.machineCode(),
					m.activeFrom(), m.activeTo(), cells,
					new Totals(t.totalWork(), t.paidLeave(), t.unpaidLeave(), t.holidayLeave(), t.lateCount())));
		}

		LockInfo lock = locks.findBySchoolIdAndMonth(schoolId, first)
			.map(l -> new LockInfo(l.getLockedAt(), users.findById(l.getLockedBy()).map(User::getFullName).orElse(null)))
			.orElse(null);
		return new MonthSheet(month.toString(), schoolId, lock, access.canManage(schoolId), access.isChainAdmin(),
				dayInfos, staffRows, discrepancies);
	}

	/** Bảng công tháng của chính mình (nhân viên chỉ xem được bảng công của mình). */
	@Transactional(readOnly = true)
	public MySheet mySheet(String monthValue) {
		YearMonth month = parseMonth(monthValue);
		UUID staffId = SchoolScope.require().access().staffId();
		if (staffId == null) {
			throw ApiException.notFound("Tài khoản của bạn chưa được gắn với hồ sơ nhân viên.");
		}
		Staff staff = staffRepo.findById(staffId)
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy hồ sơ nhân viên."));
		LocalDate first = month.atDay(1);
		LocalDate last = month.atEndOfMonth();
		AttendanceConfig config = configService.effective(staff.getSchoolId(), first);
		Map<LocalDate, String> holidays = configService.holidayNames(staff.getSchoolId(), first, last);
		List<DayInfo> dayInfos = new ArrayList<>();
		for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
			dayInfos.add(new DayInfo(d, d.getDayOfWeek().getValue(), holidays.get(d),
					config.getWorkingWeekdays().contains(d.getDayOfWeek()),
					config.getHalfDayWeekdays().contains(d.getDayOfWeek())));
		}
		Map<String, Cell> cells = new LinkedHashMap<>();
		Map<LocalDate, String> codes = new HashMap<>();
		int late = 0;
		for (StaffAttendanceDay row : days.findByStaffIdAndWorkDateBetween(staffId, first, last)) {
			cells.put(row.getWorkDate().toString(), new Cell(row.getStatusCode(), row.getSource().name(),
					row.isDiscrepancy(), row.getLateMinutes(), row.isCountedLate(), row.getNote()));
			if (row.getStatusCode() != null) {
				codes.put(row.getWorkDate(), row.getStatusCode());
			}
			late += row.isCountedLate() ? 1 : 0;
		}
		MonthTotals t = MonthTotals.compute(month, codes, holidays.keySet(), config.getWorkingWeekdays(), late);
		return new MySheet(month.toString(), staffId, staff.getFullName(), dayInfos, cells,
				new Totals(t.totalWork(), t.paidLeave(), t.unpaidLeave(), t.holidayLeave(), t.lateCount()),
				isLocked(staff.getSchoolId(), month));
	}

	// ------------------------------------------------------------ một ô

	@Transactional(readOnly = true)
	public CellDetail cell(UUID staffId, LocalDate date) {
		UUID schoolId = currentSchool();
		access.requireView(schoolId);
		Member m = member(schoolId, staffId, date);
		StaffAttendanceDay row = days.findByStaffIdAndWorkDate(staffId, date)
			.filter(r -> r.getSchoolId().equals(schoolId))
			.orElse(null);
		AttendancePunch punch = punches.findByStaffIdAndWorkDate(staffId, date).orElse(null);
		return new CellDetail(staffId, m.fullName(), date, row == null ? null : row.getStatusCode(),
				row == null ? null : row.getSource().name(), punch == null ? null : punch.getCheckIn(),
				punch == null ? null : punch.getCheckOut(), row != null && row.isDiscrepancy(),
				row == null ? null : row.getDiscrepancyReason(), row == null ? null : row.getSuggestedStatus(),
				row == null ? 0 : row.getLateMinutes(), row != null && row.isCountedLate(),
				row == null ? null : row.getNote(), row == null ? null : row.getLeaveTime(),
				row == null ? null : row.getReturnTime(), isLocked(schoolId, YearMonth.from(date)));
	}

	@Transactional
	public CellDetail updateCell(UUID staffId, LocalDate date, UpdateCellRequest request) {
		UUID schoolId = currentSchool();
		access.requireManage(schoolId);
		requireUnlocked(schoolId, YearMonth.from(date));
		member(schoolId, staffId, date);
		String code = validCode(request.code());
		StaffAttendanceDay row = rowFor(schoolId, staffId, date);
		Map<String, Object> before = snapshot(row);
		row.setStatus(code, Source.MANUAL, SchoolScope.require().userId());
		row.setDetails(blankToNull(request.note()), request.leaveTime(), request.returnTime());
		days.save(row);
		audit.record("attendance.day", staffId, Action.UPDATE, before, snapshot(row));
		return cell(staffId, date);
	}

	private StaffAttendanceDay rowFor(UUID schoolId, UUID staffId, LocalDate date) {
		return days.findByStaffIdAndWorkDate(staffId, date)
			.orElseGet(() -> new StaffAttendanceDay(schoolId, staffId, date));
	}

	/** Ghi mã từ đơn nghỉ đã duyệt (nguồn LEAVE). Người gọi đã kiểm tra quyền và khóa tháng. */
	public void writeLeaveCode(UUID schoolId, UUID staffId, LocalDate date, String code, UUID approver) {
		StaffAttendanceDay row = rowFor(schoolId, staffId, date);
		Map<String, Object> before = snapshot(row);
		row.setStatus(code, Source.LEAVE, approver);
		days.save(row);
		audit.record("attendance.day", staffId, Action.UPDATE, before, snapshot(row));
	}

	private static Map<String, Object> snapshot(StaffAttendanceDay row) {
		Map<String, Object> map = new LinkedHashMap<>();
		map.put("date", row.getWorkDate().toString());
		map.put("code", row.getStatusCode());
		map.put("source", row.getSource().name());
		map.put("note", row.getNote());
		return map;
	}

	// ------------------------------------------------------------ import + đối soát

	@Transactional
	public ImportResult importPunches(ImportRequest request) {
		YearMonth month = parseMonth(request.month());
		UUID schoolId = currentSchool();
		access.requireManage(schoolId);
		requireUnlocked(schoolId, month);
		if (request.fileId() != null) {
			fileService.requireAttachable(request.fileId());
		}
		for (ImportRow row : request.rows()) {
			if (!YearMonth.from(row.workDate()).equals(month)) {
				throw AttendanceConfigService.fieldError("rows",
						"Dữ liệu có ngày %s ngoài tháng %s".formatted(row.workDate(), month));
			}
		}

		List<Member> members = roster.members(schoolId, month);
		Map<String, Member> byCode = members.stream()
			.filter(m -> m.machineCode() != null)
			.collect(Collectors.toMap(m -> m.machineCode().toUpperCase(Locale.ROOT), Function.identity(), (a, b) -> a));

		Map<String, UnmatchedCode> unmatched = new LinkedHashMap<>();
		Map<String, ImportRow> matched = new LinkedHashMap<>();
		Map<String, Member> matchedMember = new HashMap<>();
		for (ImportRow row : request.rows()) {
			String code = row.machineCode().trim().toUpperCase(Locale.ROOT);
			Member m = byCode.get(code);
			if (m == null || !m.covers(row.workDate())) {
				unmatched.merge(code, new UnmatchedCode(row.machineCode().trim(), row.name(), 1),
						(a, b) -> new UnmatchedCode(a.machineCode(), a.name(), a.rows() + 1));
				continue;
			}
			// Trùng (người, ngày) trong file: dòng sau ghi đè
			matched.put(key(m.staffId(), row.workDate()), row);
			matchedMember.put(key(m.staffId(), row.workDate()), m);
		}

		AttendanceImportBatch batch = batches.save(new AttendanceImportBatch(schoolId, month.atDay(1),
				request.fileId(), request.rows().size(), matched.size(),
				unmatched.values().stream().map(UnmatchedCode::machineCode).toList()));

		Map<String, AttendancePunch> existing = punches
			.findBySchoolIdAndWorkDateBetween(schoolId, month.atDay(1), month.atEndOfMonth())
			.stream()
			.collect(Collectors.toMap(p -> key(p.getStaffId(), p.getWorkDate()), Function.identity()));
		for (Map.Entry<String, ImportRow> entry : matched.entrySet()) {
			ImportRow row = entry.getValue();
			Member m = matchedMember.get(entry.getKey());
			AttendancePunch punch = existing.getOrDefault(entry.getKey(),
					new AttendancePunch(schoolId, m.staffId(), row.workDate()));
			punch.update(batch.getId(), row.machineCode().trim(), blankToNull(row.checkIn()), blankToNull(row.checkOut()));
			punches.save(punch);
		}

		ReconcileSummary summary = reconcileMonth(schoolId, month);
		audit.record("attendance.import", batch.getId(), Action.CREATE, null,
				Map.of("month", month.toString(), "rows", request.rows().size(), "matched", matched.size(),
						"unmatchedCodes", unmatched.keySet()));
		return new ImportResult(batch.getId(), request.rows().size(), matched.size(),
				(int) matchedMember.values().stream().map(Member::staffId).distinct().count(),
				List.copyOf(unmatched.values()), summary.discrepancies(), summary.autoFilled());
	}

	public record ReconcileSummary(int discrepancies, int autoFilled) {
	}

	/**
	 * Đối soát lại cả tháng của cơ sở từ giờ máy và mã chấm tay hiện có. Mã tự điền từ máy (nguồn MACHINE) được tính
	 * lại, không coi là chấm tay; mã chấm tay và mã từ đơn nghỉ giữ nguyên.
	 */
	@Transactional
	public ReconcileSummary reconcileMonth(UUID schoolId, YearMonth month) {
		LocalDate first = month.atDay(1);
		LocalDate last = month.atEndOfMonth();
		Map<UUID, Member> members = roster.members(schoolId, month)
			.stream()
			.collect(Collectors.toMap(Member::staffId, Function.identity()));
		Map<String, StaffAttendanceDay> rows = days.findBySchoolIdAndWorkDateBetween(schoolId, first, last)
			.stream()
			.filter(r -> members.containsKey(r.getStaffId()) && members.get(r.getStaffId()).covers(r.getWorkDate()))
			.collect(Collectors.toMap(r -> key(r.getStaffId(), r.getWorkDate()), Function.identity()));

		List<Punch> punchList = punches.findBySchoolIdAndWorkDateBetween(schoolId, first, last)
			.stream()
			.filter(p -> members.containsKey(p.getStaffId()) && members.get(p.getStaffId()).covers(p.getWorkDate()))
			.map(p -> new Punch(p.getStaffId().toString(), p.getWorkDate(), p.getCheckIn(), p.getCheckOut()))
			.toList();
		List<Mark> marks = rows.values()
			.stream()
			.filter(r -> r.getStatusCode() != null && r.getSource() != Source.MACHINE)
			.map(r -> new Mark(r.getStaffId().toString(), r.getWorkDate(), r.getStatusCode()))
			.toList();

		AttendanceReconciler.Config config = AttendanceConfigService
			.engineConfig(configService.effective(schoolId, first));
		List<DayResult> results = AttendanceReconciler.reconcile(config, punchList, marks);

		int discrepancies = 0;
		int autoFilled = 0;
		Set<String> seen = new java.util.HashSet<>();
		List<StaffAttendanceDay> toSave = new ArrayList<>();
		for (DayResult r : results) {
			UUID staffId = UUID.fromString(r.key());
			String k = key(staffId, r.date());
			seen.add(k);
			StaffAttendanceDay row = rows.get(k);
			if (row == null) {
				row = new StaffAttendanceDay(schoolId, staffId, r.date());
			}
			row.applyReconciliation(r.lateMinutes(), r.countedLate(), r.discrepancy(), r.reason(), r.suggestedStatus());
			if (row.getStatusCode() == null || row.getSource() == Source.MACHINE) {
				String auto = AttendanceReconciler.autoStatus(r);
				row.autoFill(auto);
				autoFilled += auto == null ? 0 : 1;
			}
			discrepancies += row.isDiscrepancy() ? 1 : 0;
			toSave.add(row);
		}
		for (Map.Entry<String, StaffAttendanceDay> entry : rows.entrySet()) {
			if (seen.contains(entry.getKey())) {
				continue;
			}
			StaffAttendanceDay row = entry.getValue();
			row.clearReconciliation();
			if (row.getSource() == Source.MACHINE) {
				row.autoFill(null);
			}
			toSave.add(row);
		}
		days.saveAll(toSave);
		return new ReconcileSummary(discrepancies, autoFilled);
	}

	// ------------------------------------------------------------ sai lệch

	@Transactional(readOnly = true)
	public List<DiscrepancyItem> discrepancies(String monthValue) {
		YearMonth month = parseMonth(monthValue);
		UUID schoolId = currentSchool();
		access.requireView(schoolId);
		LocalDate first = month.atDay(1);
		LocalDate last = month.atEndOfMonth();
		Map<UUID, Member> members = roster.members(schoolId, month)
			.stream()
			.collect(Collectors.toMap(Member::staffId, Function.identity()));
		Map<String, AttendancePunch> punchMap = punches.findBySchoolIdAndWorkDateBetween(schoolId, first, last)
			.stream()
			.collect(Collectors.toMap(p -> key(p.getStaffId(), p.getWorkDate()), Function.identity()));
		return days.findBySchoolIdAndWorkDateBetween(schoolId, first, last)
			.stream()
			.filter(r -> r.isDiscrepancy() && members.containsKey(r.getStaffId())
					&& members.get(r.getStaffId()).covers(r.getWorkDate()))
			.sorted(java.util.Comparator.comparing(StaffAttendanceDay::getWorkDate)
				.thenComparing(r -> members.get(r.getStaffId()).fullName()))
			.map(r -> {
				Member m = members.get(r.getStaffId());
				AttendancePunch p = punchMap.get(key(r.getStaffId(), r.getWorkDate()));
				return new DiscrepancyItem(r.getStaffId(), m.staffCode(), m.fullName(), r.getWorkDate(),
						p == null ? null : p.getCheckIn(), p == null ? null : p.getCheckOut(), r.getStatusCode(),
						Objects.requireNonNullElse(r.getDiscrepancyReason(), ""), r.getSuggestedStatus());
			})
			.toList();
	}

	/** Xác nhận hàng loạt: ghi mã đã chọn cho từng ngày sai lệch (bỏ cờ sai lệch). */
	@Transactional
	public int resolve(ResolveRequest request) {
		YearMonth month = parseMonth(request.month());
		UUID schoolId = currentSchool();
		access.requireManage(schoolId);
		requireUnlocked(schoolId, month);
		Map<UUID, Member> members = roster.members(schoolId, month)
			.stream()
			.collect(Collectors.toMap(Member::staffId, Function.identity()));
		UUID userId = SchoolScope.require().userId();
		for (ResolveItem item : request.items()) {
			Member m = members.get(item.staffId());
			if (m == null || !m.covers(item.date()) || !YearMonth.from(item.date()).equals(month)) {
				throw ApiException.notFound("Nhân viên không thuộc bảng công của cơ sở vào ngày " + item.date() + ".");
			}
			String code = validCode(item.code());
			StaffAttendanceDay row = rowFor(schoolId, item.staffId(), item.date());
			Map<String, Object> before = snapshot(row);
			row.setStatus(code, Source.MANUAL, userId);
			days.save(row);
			audit.record("attendance.day", item.staffId(), Action.UPDATE, before, snapshot(row));
		}
		return request.items().size();
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
