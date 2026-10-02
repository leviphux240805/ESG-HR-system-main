package com.preschool.classroom.service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.classroom.dto.AttendanceDtos.MarkRequest;
import com.preschool.classroom.dto.AttendanceDtos.MarkRow;
import com.preschool.classroom.dto.AttendanceDtos.PickUpPerson;
import com.preschool.classroom.dto.AttendanceDtos.RollCall;
import com.preschool.classroom.dto.AttendanceDtos.RollCallRow;
import com.preschool.classroom.dto.AttendanceDtos.RollCallSummary;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ChildAttendance;
import com.preschool.classroom.entity.ChildAttendanceConfig;
import com.preschool.classroom.entity.ChildGuardian;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.Guardian;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.ChildAttendanceConfigRepository;
import com.preschool.classroom.repository.ChildAttendanceRepository;
import com.preschool.classroom.repository.ChildGuardianRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.classroom.repository.GuardianRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.school.repository.HolidayRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Điểm danh trẻ cả lớp theo ngày. Giáo viên của lớp điểm danh trong ngày, trước giờ báo ăn; hiệu trưởng/văn phòng
 * sửa được ngày đã qua. Đã chốt thì không ai sửa cho tới khi hiệu trưởng mở lại kèm lý do. Trẻ bảo lưu không có
 * trong danh sách.
 */
@Service
public class ChildAttendanceService {

	private static final ZoneId VN = ZoneId.of(SchedulingConfig.ZONE);

	private static final LocalTime DEFAULT_CUTOFF = LocalTime.of(8, 30);

	private final ChildAttendanceRepository attendance;

	private final ChildAttendanceConfigRepository configs;

	private final ClassEnrollmentRepository enrollments;

	private final ChildRepository children;

	private final ChildGuardianRepository links;

	private final GuardianRepository guardians;

	private final HolidayRepository holidays;

	private final ClassroomService classroom;

	private final ClassroomAccess access;

	private final AuditService audit;

	private final Clock clock;

	public ChildAttendanceService(ChildAttendanceRepository attendance, ChildAttendanceConfigRepository configs,
			ClassEnrollmentRepository enrollments, ChildRepository children, ChildGuardianRepository links,
			GuardianRepository guardians, HolidayRepository holidays, ClassroomService classroom,
			ClassroomAccess access, AuditService audit, Clock clock) {
		this.attendance = attendance;
		this.configs = configs;
		this.enrollments = enrollments;
		this.children = children;
		this.links = links;
		this.guardians = guardians;
		this.holidays = holidays;
		this.classroom = classroom;
		this.access = access;
		this.audit = audit;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public RollCall rollCall(UUID classId, LocalDate date) {
		SchoolClass c = classroom.findVisible(classId);
		return build(c, date != null ? date : classroom.today());
	}

	/** Điểm danh cả lớp một lần (chỉ những trẻ gửi lên; trẻ khác giữ nguyên). */
	@Transactional
	public RollCall mark(UUID classId, MarkRequest request) {
		SchoolClass c = classroom.findVisible(classId);
		LocalDate date = request.date();
		requireEditable(c, date);
		Map<UUID, Child> roster = roster(c, date).stream().collect(Collectors.toMap(Child::getId, Function.identity()));
		Map<UUID, ChildAttendance> existing = attendance.findByChildIdInAndAttendDateBetween(roster.keySet(), date, date)
			.stream()
			.collect(Collectors.toMap(ChildAttendance::getChildId, Function.identity()));
		Map<UUID, Set<UUID>> pickUps = links.findByChildIdIn(roster.keySet())
			.stream()
			.filter(ChildGuardian::isCanPickUp)
			.collect(Collectors.groupingBy(ChildGuardian::getChildId,
					Collectors.mapping(ChildGuardian::getGuardianId, Collectors.toSet())));
		boolean today = date.equals(classroom.today());
		for (MarkRow row : request.rows()) {
			if (!roster.containsKey(row.childId())) {
				throw ApiException.badRequest("CHILD_NOT_IN_CLASS", "Có trẻ không thuộc lớp vào ngày này.");
			}
			if (row.pickedUpBy() != null
					&& !pickUps.getOrDefault(row.childId(), Set.of()).contains(row.pickedUpBy())) {
				throw ApiException.badRequest("INVALID_PICKUP", "Người đón không có trong danh sách được phép đón trẻ.");
			}
			ChildAttendance a = existing.get(row.childId());
			if (a == null) {
				a = new ChildAttendance(c.getSchoolId(), row.childId(), c.getId(), date, row.status());
				existing.put(row.childId(), a);
			}
			Instant checkIn = row.checkInTime() != null ? at(date, row.checkInTime())
					: today ? Instant.now(clock) : null;
			a.mark(row.status(), c.getId(), blankToNull(row.note()), checkIn);
			if (row.status() == AttendanceStatus.PRESENT) {
				if (row.checkInTime() != null) {
					a.checkIn(checkIn);
				}
				if (row.checkOutTime() != null || row.pickedUpBy() != null) {
					a.pickUp(row.checkOutTime() == null ? null : at(date, row.checkOutTime()), row.pickedUpBy());
				}
			}
			attendance.save(a);
		}
		attendance.flush();
		return build(c, date);
	}

	/** Chốt điểm danh trong ngày: cần điểm danh đủ cả lớp. */
	@Transactional
	public RollCall lock(UUID classId, LocalDate date) {
		SchoolClass c = classroom.findVisible(classId);
		requireEditable(c, date);
		List<Child> roster = roster(c, date);
		List<ChildAttendance> marks = attendance.findByChildIdInAndAttendDateBetween(
				roster.stream().map(Child::getId).toList(), date, date);
		int unmarked = roster.size() - marks.size();
		if (unmarked > 0) {
			throw ApiException.badRequest("ATTENDANCE_INCOMPLETE",
					"Còn " + unmarked + " trẻ chưa điểm danh, chưa chốt được.");
		}
		Instant now = Instant.now(clock);
		marks.forEach(m -> m.lock(now));
		attendance.flush();
		audit.record("child.attendance", c.getId(), Action.UPDATE, null, Map.of("date", date, "locked", true));
		return build(c, date);
	}

	/** Mở lại ngày đã chốt (hiệu trưởng hoặc văn phòng, bắt buộc lý do). */
	@Transactional
	public RollCall unlock(UUID classId, LocalDate date, String reason) {
		SchoolClass c = classroom.findVisible(classId);
		access.requireManage(c.getSchoolId());
		List<ChildAttendance> marks = attendance.findByClassIdAndAttendDate(c.getId(), date);
		if (marks.stream().noneMatch(ChildAttendance::isLocked)) {
			throw ApiException.conflict("ATTENDANCE_NOT_LOCKED", "Điểm danh ngày này chưa chốt.");
		}
		marks.forEach(ChildAttendance::unlock);
		attendance.flush();
		audit.record("child.attendance", c.getId(), Action.UPDATE, Map.of("date", date, "locked", true),
				Map.of("date", date, "locked", false, "reason", reason.trim()));
		return build(c, date);
	}

	// ------------------------------------------------------------ hỗ trợ

	private RollCall build(SchoolClass c, LocalDate date) {
		List<Child> roster = roster(c, date);
		List<UUID> ids = roster.stream().map(Child::getId).toList();
		Map<UUID, ChildAttendance> marks = attendance.findByChildIdInAndAttendDateBetween(ids, date, date)
			.stream()
			.collect(Collectors.toMap(ChildAttendance::getChildId, Function.identity()));
		List<ChildGuardian> pickUpLinks = links.findByChildIdIn(ids).stream().filter(ChildGuardian::isCanPickUp).toList();
		Map<UUID, Guardian> guardianById = guardians
			.findByIdIn(pickUpLinks.stream().map(ChildGuardian::getGuardianId).toList())
			.stream()
			.collect(Collectors.toMap(Guardian::getId, Function.identity()));
		Map<UUID, List<PickUpPerson>> pickUps = pickUpLinks.stream()
			.filter(l -> guardianById.containsKey(l.getGuardianId()))
			.collect(Collectors.groupingBy(ChildGuardian::getChildId, Collectors.mapping(
					l -> new PickUpPerson(l.getGuardianId(), guardianById.get(l.getGuardianId()).getFullName(),
							l.getRelationship()),
					Collectors.toList())));
		List<RollCallRow> rows = roster.stream().map(k -> {
			ChildAttendance a = marks.get(k.getId());
			return new RollCallRow(k.getId(), k.getChildCode(), k.getFullName(), k.getNickname(), k.getGender(),
					k.getAllergyNote(), a == null ? null : a.getStatus(), a == null ? null : time(a.getCheckInAt()),
					a == null ? null : time(a.getCheckOutAt()), a == null ? null : a.getPickedUpBy(),
					a == null ? null : a.getNote(), pickUps.getOrDefault(k.getId(), List.of()));
		}).toList();
		boolean locked = marks.values().stream().anyMatch(ChildAttendance::isLocked);
		return new RollCall(c.getId(), c.getName(), date, isSchoolDay(c.getSchoolId(), date), cutoff(c.getSchoolId(), date),
				locked, editBlock(c, date, locked) == null, access.canManage(c.getSchoolId()) && locked,
				summary(rows), rows);
	}

	/** Trẻ của lớp vào ngày `date`, trừ trẻ bảo lưu; xếp theo tên. */
	private List<Child> roster(SchoolClass c, LocalDate date) {
		List<UUID> ids = enrollments.findInClassOn(c.getId(), date).stream().map(ClassEnrollment::getChildId).toList();
		return children.findAllById(ids)
			.stream()
			.filter(k -> k.getStatus() != ChildStatus.RESERVED)
			.sorted(Comparator.comparing(Child::getFullName))
			.toList();
	}

	private void requireEditable(SchoolClass c, LocalDate date) {
		boolean locked = attendance.findByClassIdAndAttendDate(c.getId(), date).stream().anyMatch(ChildAttendance::isLocked);
		ApiException block = editBlock(c, date, locked);
		if (block != null) {
			throw block;
		}
	}

	/** Lý do không được điểm danh lớp này vào ngày này; rỗng = được. */
	ApiException editBlock(SchoolClass c, LocalDate date, boolean locked) {
		boolean manager = access.canManage(c.getSchoolId());
		boolean teacher = access.isTeacherAt(c.getSchoolId()) && access.myClassIds().contains(c.getId());
		if (!manager && !teacher) {
			return ApiException.forbidden("ATTENDANCE_FORBIDDEN", "Bạn không có quyền điểm danh lớp này.");
		}
		LocalDate today = classroom.today();
		if (date.isAfter(today)) {
			return ApiException.badRequest("FUTURE_DATE", "Chưa tới ngày này, không điểm danh trước được.");
		}
		if (locked) {
			return ApiException.conflict("ATTENDANCE_LOCKED", "Điểm danh ngày này đã chốt; liên hệ hiệu trưởng để mở lại.");
		}
		if (!manager && (date.isBefore(today) || !LocalTime.now(clock.withZone(VN)).isBefore(cutoff(c.getSchoolId(), date)))) {
			return ApiException.conflict("ATTENDANCE_CUTOFF",
					"Đã qua giờ báo ăn; liên hệ hiệu trưởng nếu cần sửa điểm danh.");
		}
		return null;
	}

	private LocalTime cutoff(UUID schoolId, LocalDate date) {
		return configs.findFirstBySchoolIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(schoolId, date)
			.or(() -> configs.findFirstBySchoolIdIsNullAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(date))
			.map(ChildAttendanceConfig::getMealCutoffTime)
			.orElse(DEFAULT_CUTOFF);
	}

	/** Ngày học: trừ Chủ nhật và ngày lễ (chung tổ chức hoặc riêng trường). */
	public boolean isSchoolDay(UUID schoolId, LocalDate date) {
		return date.getDayOfWeek() != DayOfWeek.SUNDAY && holidays.findByHolidayDateBetweenOrderByHolidayDate(date, date)
			.stream()
			.noneMatch(h -> h.getSchoolId() == null || h.getSchoolId().equals(schoolId));
	}

	private static RollCallSummary summary(List<RollCallRow> rows) {
		Map<AttendanceStatus, Long> count = rows.stream()
			.filter(r -> r.status() != null)
			.collect(Collectors.groupingBy(RollCallRow::status, Collectors.counting()));
		int present = count.getOrDefault(AttendanceStatus.PRESENT, 0L).intValue();
		int excused = count.getOrDefault(AttendanceStatus.EXCUSED, 0L).intValue();
		int absent = count.getOrDefault(AttendanceStatus.ABSENT, 0L).intValue();
		return new RollCallSummary(rows.size(), present, excused, absent, rows.size() - present - excused - absent);
	}

	private static Instant at(LocalDate date, LocalTime time) {
		return ZonedDateTime.of(date, time, VN).toInstant();
	}

	private static LocalTime time(Instant at) {
		return at == null ? null : LocalTime.ofInstant(at, VN).withNano(0);
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

}
