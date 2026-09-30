package com.preschool.attendance.service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.attendance.dto.AttendanceConfigDtos.ConfigDto;
import com.preschool.attendance.dto.AttendanceConfigDtos.ConfigOverview;
import com.preschool.attendance.dto.AttendanceConfigDtos.CreateConfigRequest;
import com.preschool.attendance.dto.AttendanceConfigDtos.CreateHolidayRequest;
import com.preschool.attendance.dto.AttendanceConfigDtos.HolidayDto;
import com.preschool.attendance.engine.AttendanceReconciler;
import com.preschool.attendance.entity.AttendanceConfig;
import com.preschool.attendance.repository.AttendanceConfigRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.school.entity.Holiday;
import com.preschool.school.entity.School;
import com.preschool.school.repository.HolidayRepository;
import com.preschool.school.repository.SchoolRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cấu hình chấm công theo cơ sở (bản mới theo ngày hiệu lực) và ngày lễ (toàn chuỗi hoặc riêng cơ sở). */
@Service
public class AttendanceConfigService {

	static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

	private final AttendanceConfigRepository configs;

	private final HolidayRepository holidays;

	private final SchoolRepository schools;

	private final AttendanceAccess access;

	private final AuditService audit;

	private final Clock clock;

	public AttendanceConfigService(AttendanceConfigRepository configs, HolidayRepository holidays,
			SchoolRepository schools, AttendanceAccess access, AuditService audit, Clock clock) {
		this.configs = configs;
		this.holidays = holidays;
		this.schools = schools;
		this.access = access;
		this.audit = audit;
		this.clock = clock;
	}

	// ------------------------------------------------------------ cấu hình

	/**
	 * Bản cấu hình áp dụng cho cơ sở vào ngày {@code date}: bản của cơ sở có hiệu lực gần nhất, không có thì mặc định
	 * toàn chuỗi. Chưa có cấu hình nào → lỗi (cần văn phòng điều hành tạo mặc định).
	 */
	@Transactional(readOnly = true)
	public AttendanceConfig effective(UUID schoolId, LocalDate date) {
		return findEffective(configs.findForSchool(schoolId), schoolId, date)
			.orElseThrow(() -> ApiException.conflict("ATTENDANCE_CONFIG_MISSING",
					"Chưa có cấu hình chấm công. Văn phòng điều hành cần tạo cấu hình mặc định."));
	}

	private static Optional<AttendanceConfig> findEffective(List<AttendanceConfig> versions, UUID schoolId,
			LocalDate date) {
		Comparator<AttendanceConfig> latest = Comparator.comparing(AttendanceConfig::getEffectiveFrom);
		Optional<AttendanceConfig> own = versions.stream()
			.filter(c -> schoolId != null && schoolId.equals(c.getSchoolId()) && !c.getEffectiveFrom().isAfter(date))
			.max(latest);
		return own.isPresent() ? own
				: versions.stream()
					.filter(c -> c.getSchoolId() == null && !c.getEffectiveFrom().isAfter(date))
					.max(latest);
	}

	/** Tham số cho bộ đối soát từ cấu hình. */
	public static AttendanceReconciler.Config engineConfig(AttendanceConfig c) {
		return new AttendanceReconciler.Config(c.getShiftStart(), c.getLateGraceMinutes(), c.getMaxLateCountAllowed(),
				c.getLunchStart(), c.getLunchEnd(), c.getHalfDayWeekdays());
	}

	@Transactional(readOnly = true)
	public ConfigOverview overview(UUID schoolId) {
		List<AttendanceConfig> versions;
		boolean canManage;
		if (schoolId == null) {
			versions = configs.findChainDefaults();
			canManage = access.isChainAdmin();
		}
		else {
			access.requireView(schoolId);
			versions = configs.findForSchool(schoolId);
			canManage = access.canManage(schoolId);
		}
		LocalDate today = LocalDate.now(clock.withZone(VN));
		return new ConfigOverview(findEffective(versions, schoolId, today).map(AttendanceConfigService::toDto).orElse(null),
				versions.stream().map(AttendanceConfigService::toDto).toList(), canManage);
	}

	/** Thêm bản cấu hình mới (không sửa bản cũ; bảng công đã tính giữ theo bản cũ). */
	@Transactional
	public ConfigDto create(CreateConfigRequest r) {
		if (r.schoolId() == null) {
			access.requireChainAdmin("Chỉ văn phòng điều hành đổi cấu hình mặc định toàn chuỗi.");
		}
		else {
			access.requireManage(r.schoolId());
		}
		if (!r.shiftStart().isBefore(r.shiftEnd())) {
			throw fieldError("shiftEnd", "Giờ ra ca phải sau giờ vào ca");
		}
		if (!r.lunchStart().isAfter(r.shiftStart()) || !r.lunchStart().isBefore(r.lunchEnd())
				|| !r.lunchEnd().isBefore(r.shiftEnd())) {
			throw fieldError("lunchEnd", "Giờ nghỉ trưa phải nằm trong ca và kết thúc sau khi bắt đầu");
		}
		Set<DayOfWeek> working = days(r.workingWeekdays());
		Set<DayOfWeek> halfDay = days(r.halfDayWeekdays());
		if (!working.containsAll(halfDay)) {
			throw fieldError("halfDayWeekdays", "Ngày làm nửa buổi phải là ngày làm việc");
		}
		if (configs.existsVersion(r.schoolId(), r.effectiveFrom())) {
			throw ApiException.conflict("CONFIG_VERSION_EXISTS", "Đã có cấu hình hiệu lực từ ngày này.")
				.withFieldErrors(List.of(Map.of("field", "effectiveFrom", "message", "đã có cấu hình hiệu lực từ ngày này")));
		}
		AttendanceConfig config = configs.saveAndFlush(new AttendanceConfig(r.schoolId(), r.effectiveFrom(),
				r.shiftStart(), r.shiftEnd(), r.lunchStart(), r.lunchEnd(), r.graceMinutes(), r.maxLateAllowed(),
				working, halfDay, r.annualLeaveDays()));
		ConfigDto dto = toDto(config);
		audit.record("attendance.config", config.getId(), Action.CREATE, null, dto);
		return dto;
	}

	private static Set<DayOfWeek> days(List<Integer> values) {
		Set<DayOfWeek> result = EnumSet.noneOf(DayOfWeek.class);
		values.forEach(v -> result.add(DayOfWeek.of(v)));
		return result;
	}

	static ConfigDto toDto(AttendanceConfig c) {
		return new ConfigDto(c.getId(), c.getSchoolId(), c.getEffectiveFrom(), c.getShiftStart(), c.getShiftEnd(),
				c.getLunchStart(), c.getLunchEnd(), c.getLateGraceMinutes(), c.getMaxLateCountAllowed(),
				c.getWorkingWeekdays().stream().map(DayOfWeek::getValue).toList(),
				c.getHalfDayWeekdays().stream().map(DayOfWeek::getValue).toList(), c.getAnnualLeaveDays());
	}

	// ------------------------------------------------------------ ngày lễ

	/** Ngày lễ áp dụng cho cơ sở trong khoảng (toàn chuỗi + riêng cơ sở), kèm tên. */
	@Transactional(readOnly = true)
	public Map<LocalDate, String> holidayNames(UUID schoolId, LocalDate from, LocalDate to) {
		Map<LocalDate, String> result = new java.util.TreeMap<>();
		holidays.findByHolidayDateBetweenOrderByHolidayDate(from, to)
			.stream()
			.filter(h -> h.getSchoolId() == null || h.getSchoolId().equals(schoolId))
			.forEach(h -> result.merge(h.getHolidayDate(), h.getName(), (a, b) -> a));
		return result;
	}

	@Transactional(readOnly = true)
	public List<HolidayDto> listHolidays(int year) {
		if (!access.canViewAny() && !access.isChainAdmin()) {
			throw ApiException.forbidden("ATTENDANCE_FORBIDDEN", "Bạn không có quyền xem danh sách ngày lễ.");
		}
		Map<UUID, String> names = schoolNames();
		return holidays.findByHolidayDateBetweenOrderByHolidayDate(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))
			.stream()
			.map(h -> toDto(h, names))
			.toList();
	}

	@Transactional
	public List<HolidayDto> addHolidays(CreateHolidayRequest r) {
		requireManageHoliday(r.schoolId());
		LocalDate to = r.toDate() == null ? r.fromDate() : r.toDate();
		if (to.isBefore(r.fromDate())) {
			throw fieldError("toDate", "Đến ngày phải sau từ ngày");
		}
		if (r.fromDate().plusDays(31).isBefore(to)) {
			throw fieldError("toDate", "Mỗi lần thêm tối đa 31 ngày");
		}
		Set<LocalDate> existing = holidays.findByHolidayDateBetweenOrderByHolidayDate(r.fromDate(), to)
			.stream()
			.filter(h -> java.util.Objects.equals(h.getSchoolId(), r.schoolId()))
			.map(Holiday::getHolidayDate)
			.collect(Collectors.toSet());
		List<Holiday> created = new ArrayList<>();
		for (LocalDate d = r.fromDate(); !d.isAfter(to); d = d.plusDays(1)) {
			if (!existing.contains(d)) {
				created.add(holidays.save(new Holiday(r.schoolId(), d, r.name().trim(), r.schoolId() != null)));
			}
		}
		if (created.isEmpty()) {
			throw ApiException.conflict("HOLIDAY_EXISTS", "Các ngày này đã có trong danh sách ngày lễ.");
		}
		Map<UUID, String> names = schoolNames();
		created.forEach(h -> audit.record("holiday", h.getId(), Action.CREATE, null,
				Map.of("date", h.getHolidayDate().toString(), "name", h.getName())));
		return created.stream().map(h -> toDto(h, names)).toList();
	}

	@Transactional
	public void deleteHoliday(UUID id) {
		Holiday holiday = holidays.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy ngày lễ."));
		requireManageHoliday(holiday.getSchoolId());
		audit.record("holiday", id, Action.DELETE,
				Map.of("date", holiday.getHolidayDate().toString(), "name", holiday.getName()), null);
		holidays.delete(holiday);
	}

	private void requireManageHoliday(UUID schoolId) {
		if (schoolId == null) {
			access.requireChainAdmin("Chỉ văn phòng điều hành quản lý ngày lễ toàn chuỗi.");
		}
		else {
			access.requireManage(schoolId);
		}
	}

	private boolean canManageHoliday(UUID schoolId) {
		return schoolId == null ? access.isChainAdmin() : access.canManage(schoolId);
	}

	private HolidayDto toDto(Holiday h, Map<UUID, String> names) {
		return new HolidayDto(h.getId(), h.getSchoolId(), names.get(h.getSchoolId()), h.getHolidayDate(), h.getName(),
				canManageHoliday(h.getSchoolId()));
	}

	private Map<UUID, String> schoolNames() {
		return schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
	}

	static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_FAILED", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

}
