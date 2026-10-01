package com.preschool.today.service;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.repository.UserRepository;
import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.classroom.service.ChildAttendanceService;
import com.preschool.classroom.service.ClassroomService;
import com.preschool.common.error.ApiException;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.notification.service.NotificationService;
import com.preschool.security.SchoolScope;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.today.dto.TodayDtos.AbsentChild;
import com.preschool.today.dto.TodayDtos.ApprovalType;
import com.preschool.today.dto.TodayDtos.LeaveClass;
import com.preschool.today.dto.TodayDtos.StaffLeave;
import com.preschool.today.dto.TodayDtos.StaffOption;
import com.preschool.today.dto.TodayDtos.SubstitutionRequest;
import com.preschool.today.dto.TodayDtos.TodayClass;
import com.preschool.today.dto.TodayDtos.TodaySummary;
import com.preschool.today.dto.TodayDtos.TodayTeacher;
import com.preschool.today.entity.ClassSubstitution;
import com.preschool.today.repository.ClassSubstitutionRepository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trang Hôm nay của ban giám hiệu, gộp các trường đang chọn mà người xem quản lý nhóm Lớp & trẻ, và phân công dạy
 * thay. Số liệu tổng hợp bằng SQL với danh sách trường truyền tường minh (như báo cáo).
 * TODO(assumption): Hôm nay cho hiệu trưởng và phó hiệu trưởng nhóm Lớp & trẻ; phân công dạy thay thêm nhóm Nhân sự.
 */
@Service
public class TodayService {

	private static final ZoneId VN = ZoneId.of(SchedulingConfig.ZONE);

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private final NamedParameterJdbcTemplate jdbc;

	private final ClassroomService classrooms;

	private final ChildAttendanceService childAttendance;

	private final ApprovalService approvals;

	private final ClassSubstitutionRepository substitutions;

	private final UserRepository users;

	private final NotificationService notifications;

	private final Clock clock;

	public TodayService(NamedParameterJdbcTemplate jdbc, ClassroomService classrooms,
			ChildAttendanceService childAttendance, ApprovalService approvals,
			ClassSubstitutionRepository substitutions, UserRepository users, NotificationService notifications,
			Clock clock) {
		this.jdbc = jdbc;
		this.classrooms = classrooms;
		this.childAttendance = childAttendance;
		this.approvals = approvals;
		this.substitutions = substitutions;
		this.users = users;
		this.notifications = notifications;
		this.clock = clock;
	}

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	private static boolean canAssign(UUID schoolId) {
		return scope().manages(schoolId, FunctionGroup.CLASSROOM) || scope().manages(schoolId, FunctionGroup.HR);
	}

	@Transactional(readOnly = true)
	public TodaySummary today() {
		List<UUID> ids = scope().effectiveSchoolIds()
			.stream()
			.filter(id -> scope().manages(id, FunctionGroup.CLASSROOM))
			.toList();
		if (ids.isEmpty()) {
			throw ApiException.forbidden("TODAY_FORBIDDEN", "Bạn không có quyền xem trang Hôm nay.");
		}
		LocalDate day = classrooms.today();
		MapSqlParameterSource p = new MapSqlParameterSource("ids", ids).addValue("day", Date.valueOf(day));

		// Nhân viên nghỉ hôm nay (đơn đã duyệt) → mã công
		List<Map<String, Object>> leaveRows = jdbc.queryForList("""
				SELECT DISTINCT ON (l.staff_id) l.staff_id, l.school_id, l.leave_code, l.half_day, s.full_name, s.position
				FROM leave_requests l JOIN staff s ON s.id = l.staff_id
				WHERE l.school_id IN (:ids) AND l.status = 'APPROVED' AND :day BETWEEN l.from_date AND l.to_date
				ORDER BY l.staff_id, l.from_date DESC""", p);
		Map<UUID, String> leaveCodes = new LinkedHashMap<>();
		leaveRows.forEach(r -> leaveCodes.put(uuid(r, "staff_id"),
				(Boolean.TRUE.equals(r.get("half_day")) ? "1/2" : "") + r.get("leave_code")));

		// Người dạy thay hôm nay, theo lớp + giáo viên nghỉ
		Map<String, UUID> subStaff = new HashMap<>();
		Map<UUID, String> subNames = new HashMap<>();
		jdbc.queryForList("""
				SELECT x.class_id, x.absent_staff_id, x.staff_id, s.full_name FROM class_substitutions x
				JOIN staff s ON s.id = x.staff_id WHERE x.school_id IN (:ids) AND x.sub_date = :day""", p)
			.forEach(r -> {
				subStaff.put(key(uuid(r, "class_id"), uuid(r, "absent_staff_id")), uuid(r, "staff_id"));
				subNames.put(uuid(r, "staff_id"), (String) r.get("full_name"));
			});

		Map<UUID, List<Map<String, Object>>> teachersByClass = jdbc.queryForList("""
				SELECT t.class_id, t.staff_id, s.full_name, c.name AS class_name FROM class_teachers t
				JOIN staff s ON s.id = t.staff_id JOIN classes c ON c.id = t.class_id
				WHERE t.school_id IN (:ids) AND t.from_date <= :day AND (t.to_date IS NULL OR t.to_date >= :day)
				ORDER BY t.role, t.from_date""", p)
			.stream()
			.collect(Collectors.groupingBy(r -> uuid(r, "class_id"), LinkedHashMap::new, Collectors.toList()));

		List<TodayClass> classes = jdbc.queryForList("""
				SELECT c.id, c.school_id, sc.name AS school_name, c.name, g.name AS age_group_name,
				       (SELECT count(*) FROM class_enrollments e JOIN children k ON k.id = e.child_id
				        WHERE e.class_id = c.id AND e.to_date IS NULL AND k.deleted_at IS NULL AND k.status = 'STUDYING') AS size,
				       count(a.id) FILTER (WHERE a.status = 'PRESENT') AS present,
				       count(a.id) FILTER (WHERE a.status = 'EXCUSED') AS excused,
				       count(a.id) FILTER (WHERE a.status = 'ABSENT') AS absent,
				       count(a.id) AS marked
				FROM classes c JOIN school_years y ON y.id = c.school_year_id AND :day BETWEEN y.start_date AND y.end_date
				JOIN age_groups g ON g.id = c.age_group_id JOIN schools sc ON sc.id = c.school_id
				LEFT JOIN child_attendance a ON a.class_id = c.id AND a.attend_date = :day
				WHERE c.school_id IN (:ids)
				GROUP BY c.id, sc.name, g.name, g.order_no ORDER BY sc.name, g.order_no, c.name""", p)
			.stream()
			.map(r -> {
				UUID classId = uuid(r, "id");
				List<TodayTeacher> teachers = teachersByClass.getOrDefault(classId, List.of()).stream().map(t -> {
					UUID staffId = uuid(t, "staff_id");
					boolean onLeave = leaveCodes.containsKey(staffId);
					UUID sub = onLeave ? subStaff.get(key(classId, staffId)) : null;
					return new TodayTeacher(staffId, (String) t.get("full_name"), onLeave, sub, subNames.get(sub));
				}).toList();
				return new TodayClass(classId, uuid(r, "school_id"), (String) r.get("school_name"),
						(String) r.get("name"), (String) r.get("age_group_name"), num(r, "size"), num(r, "present"),
						num(r, "excused"), num(r, "absent"), num(r, "marked") > 0, teachers,
						teachers.stream().anyMatch(t -> t.onLeave() && t.substituteStaffId() == null));
			})
			.toList();

		List<AbsentChild> absentChildren = jdbc.queryForList("""
				SELECT a.child_id, k.full_name, a.class_id, c.name AS class_name, a.status, a.note
				FROM child_attendance a JOIN children k ON k.id = a.child_id JOIN classes c ON c.id = a.class_id
				WHERE a.school_id IN (:ids) AND a.attend_date = :day AND a.status <> 'PRESENT'
				ORDER BY c.name, k.full_name""", p)
			.stream()
			.map(r -> new AbsentChild(uuid(r, "child_id"), (String) r.get("full_name"), uuid(r, "class_id"),
					(String) r.get("class_name"), AttendanceStatus.valueOf((String) r.get("status")),
					(String) r.get("note")))
			.toList();

		List<StaffLeave> staffOnLeave = leaveRows.stream().map(r -> {
			UUID staffId = uuid(r, "staff_id");
			List<LeaveClass> taught = teachersByClass.values()
				.stream()
				.flatMap(List::stream)
				.filter(t -> uuid(t, "staff_id").equals(staffId))
				.map(t -> {
					UUID classId = uuid(t, "class_id");
					UUID sub = subStaff.get(key(classId, staffId));
					return new LeaveClass(classId, (String) t.get("class_name"), sub, subNames.get(sub));
				})
				.toList();
			return new StaffLeave(staffId, (String) r.get("full_name"), Position.valueOf((String) r.get("position")),
					uuid(r, "school_id"), leaveCodes.get(staffId), taught);
		}).toList();

		List<StaffOption> available = jdbc.queryForList("""
				SELECT id, full_name, position, school_id FROM staff
				WHERE school_id IN (:ids) AND deleted_at IS NULL AND status = 'ACTIVE' ORDER BY full_name""", p)
			.stream()
			.filter(r -> !leaveCodes.containsKey(uuid(r, "id")))
			.map(r -> new StaffOption(uuid(r, "id"), (String) r.get("full_name"),
					Position.valueOf((String) r.get("position")), uuid(r, "school_id")))
			.toList();

		Map<String, Object> due = jdbc.queryForMap("""
				SELECT count(*) FILTER (WHERE due_at >= :from AND due_at < :to) AS due_today,
				       count(*) FILTER (WHERE due_at < :now) AS overdue
				FROM tasks WHERE school_id IN (:ids) AND recurrence_rule IS NULL
				  AND status NOT IN ('DONE', 'CANCELLED')""",
				p.addValue("from", Timestamp.from(day.atStartOfDay(VN).toInstant()))
					.addValue("to", Timestamp.from(day.plusDays(1).atStartOfDay(VN).toInstant()))
					.addValue("now", Timestamp.from(clock.instant())));
		Map<ApprovalType, Long> pending = approvals.counts();

		return new TodaySummary(day, ids.stream().anyMatch(id -> childAttendance.isSchoolDay(id, day)), classes,
				absentChildren, staffOnLeave, available, pending.getOrDefault(ApprovalType.LEAVE, 0L).intValue(),
				pending.getOrDefault(ApprovalType.TASK, 0L).intValue(), num(due, "due_today"), num(due, "overdue"),
				ids.stream().anyMatch(TodayService::canAssign));
	}

	/** Phân công (hoặc đổi) người dạy thay giáo viên nghỉ ở một lớp trong ngày; người được phân công nhận thông báo. */
	@Transactional
	public void assignSubstitute(SubstitutionRequest request) {
		LocalDate date = request.date() != null ? request.date() : classrooms.today();
		Map<String, Object> cls = jdbc.queryForList("SELECT id, school_id, name FROM classes WHERE id = :id",
				new MapSqlParameterSource("id", request.classId()))
			.stream()
			.findFirst()
			.filter(c -> scope().canAccessSchool(uuid(c, "school_id")))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp."));
		UUID schoolId = uuid(cls, "school_id");
		if (!canAssign(schoolId)) {
			throw ApiException.forbidden("SUBSTITUTION_FORBIDDEN", "Bạn không có quyền phân công dạy thay ở trường này.");
		}
		MapSqlParameterSource p = new MapSqlParameterSource("classId", request.classId())
			.addValue("schoolId", schoolId)
			.addValue("absent", request.absentStaffId())
			.addValue("staff", request.staffId())
			.addValue("day", Date.valueOf(date));
		boolean teaches = !jdbc.queryForList("""
				SELECT 1 FROM class_teachers WHERE class_id = :classId AND staff_id = :absent
				  AND from_date <= :day AND (to_date IS NULL OR to_date >= :day)""", p).isEmpty();
		if (!teaches) {
			throw ApiException.badRequest("NOT_CLASS_TEACHER", "Giáo viên nghỉ không phụ trách lớp này.");
		}
		boolean colleague = !jdbc.queryForList("""
				SELECT 1 FROM staff WHERE id = :staff AND school_id = :schoolId AND deleted_at IS NULL AND status = 'ACTIVE'""",
				p).isEmpty();
		if (!colleague || request.staffId().equals(request.absentStaffId())) {
			throw ApiException.badRequest("INVALID_SUBSTITUTE", "Chọn người dạy thay đang làm việc ở cùng trường.")
				.withFieldErrors(List.of(Map.of("field", "staffId", "message", "Chọn người khác cùng trường")));
		}
		substitutions.findByClassIdAndAbsentStaffIdAndDate(request.classId(), request.absentStaffId(), date)
			.ifPresentOrElse(s -> s.reassign(request.staffId()), () -> substitutions.save(new ClassSubstitution(
					schoolId, date, request.classId(), request.absentStaffId(), request.staffId())));
		users.findByStaffId(request.staffId())
			.ifPresent(u -> notifications.notify(u.getId(), "SUBSTITUTION", "Bạn được phân công dạy thay",
					"Lớp %s ngày %s.".formatted(cls.get("name"), date.format(DATE)), "/diem-danh",
					"substitution:%s:%s:%s".formatted(request.classId(), date, request.staffId())));
	}

	private static String key(UUID classId, UUID staffId) {
		return classId + "/" + staffId;
	}

	private static UUID uuid(Map<String, Object> row, String key) {
		return (UUID) row.get(key);
	}

	private static int num(Map<String, Object> row, String key) {
		return ((Number) row.get(key)).intValue();
	}

}
