package com.preschool.classroom.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.classroom.dto.ClassroomDtos.AgeGroupDto;
import com.preschool.classroom.dto.ClassroomDtos.AgeGroupRequest;
import com.preschool.classroom.dto.ClassroomDtos.AssignTeacherRequest;
import com.preschool.classroom.dto.ClassroomDtos.ClassDetail;
import com.preschool.classroom.dto.ClassroomDtos.ClassItem;
import com.preschool.classroom.dto.ClassroomDtos.ClassRequest;
import com.preschool.classroom.dto.ClassroomDtos.SchoolYearDto;
import com.preschool.classroom.dto.ClassroomDtos.SchoolYearRequest;
import com.preschool.classroom.dto.ClassroomDtos.TeacherDto;
import com.preschool.classroom.entity.AgeGroup;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ChildAttendance;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.classroom.entity.ClassTeacher;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.classroom.repository.ChildAttendanceRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.classroom.repository.ClassTeacherRepository;
import com.preschool.classroom.repository.SchoolClassRepository;
import com.preschool.common.error.ApiException;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.school.entity.SchoolYear;
import com.preschool.school.repository.SchoolYearRepository;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.repository.StaffRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Năm học, khối độ tuổi, lớp và phân công giáo viên phụ trách. */
@Service
public class ClassroomService {

	private static final ZoneId VN = ZoneId.of(SchedulingConfig.ZONE);

	private final SchoolYearRepository schoolYears;

	private final AgeGroupRepository ageGroups;

	private final SchoolClassRepository classes;

	private final ClassTeacherRepository classTeachers;

	private final ClassEnrollmentRepository enrollments;

	private final ChildRepository children;

	private final ChildAttendanceRepository attendance;

	private final StaffRepository staffRepo;

	private final ClassroomAccess access;

	private final Clock clock;

	public ClassroomService(SchoolYearRepository schoolYears, AgeGroupRepository ageGroups,
			SchoolClassRepository classes, ClassTeacherRepository classTeachers, ClassEnrollmentRepository enrollments,
			ChildRepository children, ChildAttendanceRepository attendance, StaffRepository staffRepo,
			ClassroomAccess access, Clock clock) {
		this.schoolYears = schoolYears;
		this.ageGroups = ageGroups;
		this.classes = classes;
		this.classTeachers = classTeachers;
		this.enrollments = enrollments;
		this.children = children;
		this.attendance = attendance;
		this.staffRepo = staffRepo;
		this.access = access;
		this.clock = clock;
	}

	public LocalDate today() {
		return LocalDate.now(clock.withZone(VN));
	}

	// ------------------------------------------------------------ năm học

	@Transactional(readOnly = true)
	public List<SchoolYearDto> schoolYears() {
		return schoolYears.findAllByOrderByStartDateDesc().stream().map(ClassroomService::toDto).toList();
	}

	@Transactional
	public SchoolYearDto createSchoolYear(SchoolYearRequest request) {
		access.requireManageCatalog();
		validateYear(request);
		if (schoolYears.existsByNameIgnoreCase(request.name().trim())) {
			throw duplicateYear();
		}
		return toDto(schoolYears.save(new SchoolYear(request.name().trim(), request.startDate(), request.endDate())));
	}

	@Transactional
	public SchoolYearDto updateSchoolYear(UUID id, SchoolYearRequest request) {
		access.requireManageCatalog();
		validateYear(request);
		SchoolYear year = requireYear(id);
		if (schoolYears.existsByNameIgnoreCaseAndIdNot(request.name().trim(), id)) {
			throw duplicateYear();
		}
		year.update(request.name().trim(), request.startDate(), request.endDate());
		return toDto(year);
	}

	/** Đặt năm học hiện hành (cả tổ chức chỉ một năm hiện hành). */
	@Transactional
	public SchoolYearDto setCurrentSchoolYear(UUID id) {
		access.requireManageCatalog();
		SchoolYear year = requireYear(id);
		schoolYears.findByCurrentTrue().filter(y -> !y.getId().equals(id)).ifPresent(old -> {
			old.setCurrent(false);
			schoolYears.saveAndFlush(old);
		});
		year.setCurrent(true);
		return toDto(year);
	}

	private static void validateYear(SchoolYearRequest request) {
		if (!request.endDate().isAfter(request.startDate())) {
			throw ApiException.badRequest("INVALID_DATES", "Ngày kết thúc phải sau ngày bắt đầu.");
		}
	}

	private static ApiException duplicateYear() {
		return ApiException.conflict("DUPLICATE_SCHOOL_YEAR", "Đã có năm học trùng tên.");
	}

	SchoolYear requireYear(UUID id) {
		return schoolYears.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy năm học."));
	}

	/** Năm học theo id, hoặc năm học hiện hành khi rỗng. */
	SchoolYear yearOrCurrent(UUID id) {
		if (id != null) {
			return requireYear(id);
		}
		return schoolYears.findByCurrentTrue()
			.orElseThrow(() -> ApiException.badRequest("NO_CURRENT_YEAR", "Chưa đặt năm học hiện hành."));
	}

	private static SchoolYearDto toDto(SchoolYear y) {
		return new SchoolYearDto(y.getId(), y.getName(), y.getStartDate(), y.getEndDate(), y.isCurrent());
	}

	// ------------------------------------------------------------ khối

	@Transactional(readOnly = true)
	public List<AgeGroupDto> ageGroups() {
		return ageGroups.findAllByOrderByOrderNo().stream().map(ClassroomService::toDto).toList();
	}

	@Transactional
	public AgeGroupDto updateAgeGroup(UUID id, AgeGroupRequest request) {
		access.requireManageCatalog();
		if (request.maxMonths() <= request.minMonths()) {
			throw ApiException.badRequest("INVALID_MONTHS", "Tháng tuổi tối đa phải lớn hơn tối thiểu.");
		}
		AgeGroup group = ageGroups.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy khối."));
		group.update(request.name().trim(), request.minMonths(), request.maxMonths(), request.maxClassSize());
		return toDto(group);
	}

	private static AgeGroupDto toDto(AgeGroup g) {
		return new AgeGroupDto(g.getId(), g.getCode(), g.getName(), g.getMinMonths(), g.getMaxMonths(),
				g.getMaxClassSize());
	}

	// ------------------------------------------------------------ lớp

	/** Lớp trong phạm vi đang chọn của một năm học (rỗng = năm hiện hành); giáo viên chỉ thấy lớp mình phụ trách. */
	@Transactional(readOnly = true)
	public List<ClassItem> classes(UUID schoolYearId) {
		access.requireViewAny();
		SchoolYear year = schoolYearId != null ? requireYear(schoolYearId)
				: schoolYears.findByCurrentTrue().orElse(null);
		if (year == null) {
			return List.of();
		}
		List<SchoolClass> list = classes.findBySchoolYearIdOrderByName(year.getId())
			.stream()
			.filter(c -> access.canViewClass(c.getSchoolId(), c.getId()))
			.toList();
		return toItems(list);
	}

	@Transactional(readOnly = true)
	public ClassDetail detail(UUID id) {
		SchoolClass c = findVisible(id);
		List<ClassTeacher> history = classTeachers.findByClassIdOrderByFromDateDesc(id);
		Map<UUID, String> names = staffNames(history.stream().map(ClassTeacher::getStaffId).toList());
		return new ClassDetail(toItems(List.of(c)).getFirst(), history.stream().map(t -> toDto(t, names)).toList());
	}

	@Transactional
	public ClassItem create(ClassRequest request) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		SchoolYear year = yearOrCurrent(request.schoolYearId());
		AgeGroup group = requireAgeGroup(request.ageGroupId());
		String name = request.name().trim();
		if (classes.existsBySchoolIdAndSchoolYearIdAndName(schoolId, year.getId(), name)) {
			throw duplicateClass();
		}
		SchoolClass c = classes.save(new SchoolClass(schoolId, year.getId(), group.getId(), name,
				blankToNull(request.room()), capacity(request, group), blankToNull(request.note())));
		return toItems(List.of(c)).getFirst();
	}

	@Transactional
	public ClassItem update(UUID id, ClassRequest request) {
		SchoolClass c = findVisible(id);
		access.requireManage(c.getSchoolId());
		AgeGroup group = requireAgeGroup(request.ageGroupId());
		String name = request.name().trim();
		if (classes.existsBySchoolIdAndSchoolYearIdAndNameAndIdNot(c.getSchoolId(), c.getSchoolYearId(), name, id)) {
			throw duplicateClass();
		}
		c.update(group.getId(), name, blankToNull(request.room()), capacity(request, group),
				blankToNull(request.note()));
		return toItems(List.of(c)).getFirst();
	}

	/** Xóa lớp tạo nhầm: chỉ khi chưa từng xếp trẻ và chưa có điểm danh. */
	@Transactional
	public void delete(UUID id) {
		SchoolClass c = findVisible(id);
		access.requireManage(c.getSchoolId());
		if (enrollments.existsByClassId(id) || attendance.existsByClassId(id)) {
			throw ApiException.conflict("CLASS_IN_USE", "Lớp đã có trẻ hoặc điểm danh, không xóa được.");
		}
		classTeachers.deleteAll(classTeachers.findByClassIdOrderByFromDateDesc(id));
		classes.delete(c);
	}

	// ------------------------------------------------------------ phân công giáo viên

	@Transactional
	public ClassDetail assignTeacher(UUID classId, AssignTeacherRequest request) {
		SchoolClass c = findVisible(classId);
		access.requireManage(c.getSchoolId());
		Staff staff = staffRepo.findById(request.staffId())
			.filter(s -> c.getSchoolId().equals(s.getSchoolId()) && s.isActive())
			.orElseThrow(() -> ApiException.badRequest("INVALID_STAFF",
					"Chọn nhân viên đang làm việc ở cơ sở của lớp."));
		boolean already = classTeachers.findByClassIdAndToDateIsNull(classId)
			.stream()
			.anyMatch(t -> t.getStaffId().equals(staff.getId()));
		if (already) {
			throw ApiException.conflict("ALREADY_ASSIGNED", "Nhân viên này đang phụ trách lớp.");
		}
		LocalDate from = request.fromDate() != null ? request.fromDate() : today();
		classTeachers.saveAndFlush(new ClassTeacher(c.getSchoolId(), classId, staff.getId(), request.role(), from));
		return detail(classId);
	}

	@Transactional
	public ClassDetail endAssignment(UUID classId, UUID assignmentId, LocalDate toDate) {
		SchoolClass c = findVisible(classId);
		access.requireManage(c.getSchoolId());
		ClassTeacher t = classTeachers.findById(assignmentId)
			.filter(a -> a.getClassId().equals(classId) && a.isActive())
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy phân công."));
		t.end(toDate != null ? toDate : today());
		classTeachers.flush();
		return detail(classId);
	}

	// ------------------------------------------------------------ hỗ trợ

	/** Lớp người dùng được xem; ngoài phạm vi trả 404 để không lộ lớp của cơ sở khác. */
	public SchoolClass findVisible(UUID id) {
		return classes.findById(id)
			.filter(c -> access.canViewClass(c.getSchoolId(), c.getId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp."));
	}

	private AgeGroup requireAgeGroup(UUID id) {
		return ageGroups.findById(id)
			.orElseThrow(() -> ApiException.badRequest("INVALID_AGE_GROUP", "Khối không hợp lệ."));
	}

	private static int capacity(ClassRequest request, AgeGroup group) {
		return request.capacity() != null ? request.capacity() : group.getMaxClassSize();
	}

	private static ApiException duplicateClass() {
		return ApiException.conflict("DUPLICATE_CLASS", "Cơ sở đã có lớp trùng tên trong năm học này.")
			.withFieldErrors(List.of(Map.of("field", "name", "message", "Tên lớp đã có trong năm học này.")));
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

	private List<ClassItem> toItems(List<SchoolClass> list) {
		if (list.isEmpty()) {
			return List.of();
		}
		Set<UUID> classIds = list.stream().map(SchoolClass::getId).collect(Collectors.toSet());
		Map<UUID, AgeGroup> groups = ageGroups.findAll()
			.stream()
			.collect(Collectors.toMap(AgeGroup::getId, Function.identity()));
		Map<UUID, List<ClassTeacher>> teachers = classTeachers.findByClassIdInAndToDateIsNull(classIds)
			.stream()
			.collect(Collectors.groupingBy(ClassTeacher::getClassId));
		Map<UUID, String> names = staffNames(
				teachers.values().stream().flatMap(Collection::stream).map(ClassTeacher::getStaffId).toList());
		List<ClassEnrollment> active = enrollments.findByClassIdInAndToDateIsNull(classIds);
		Map<UUID, Child> studying = children.findAllById(active.stream().map(ClassEnrollment::getChildId).toList())
			.stream()
			.filter(Child::isStudying)
			.collect(Collectors.toMap(Child::getId, Function.identity()));
		Map<UUID, List<Child>> byClass = active.stream()
			.filter(e -> studying.containsKey(e.getChildId()))
			.collect(Collectors.groupingBy(ClassEnrollment::getClassId,
					Collectors.mapping(e -> studying.get(e.getChildId()), Collectors.toList())));
		Map<UUID, List<ChildAttendance>> todayMarks = attendance.findByClassIdInAndAttendDate(classIds, today())
			.stream()
			.collect(Collectors.groupingBy(ChildAttendance::getClassId));
		return list.stream().map(c -> {
			AgeGroup g = groups.get(c.getAgeGroupId());
			List<Child> kids = byClass.getOrDefault(c.getId(), List.of());
			int boys = (int) kids.stream().filter(k -> k.getGender() == Gender.MALE).count();
			List<ChildAttendance> marks = todayMarks.get(c.getId());
			Integer present = marks == null ? null
					: (int) marks.stream().filter(m -> m.getStatus() == AttendanceStatus.PRESENT).count();
			List<TeacherDto> teacherDtos = teachers.getOrDefault(c.getId(), List.of())
				.stream()
				.sorted(Comparator.comparing(ClassTeacher::getRole).thenComparing(ClassTeacher::getFromDate))
				.map(t -> toDto(t, names))
				.toList();
			return new ClassItem(c.getId(), c.getSchoolId(), c.getSchoolYearId(), c.getName(), c.getRoom(),
					c.getNote(), g.getId(), g.getCode(), g.getName(), c.getCapacity(), g.getMaxClassSize(),
					kids.size(), boys, kids.size() - boys, teacherDtos, present, access.canManage(c.getSchoolId()));
		}).toList();
	}

	private Map<UUID, String> staffNames(Collection<UUID> ids) {
		return staffRepo.findAllById(Set.copyOf(ids))
			.stream()
			.collect(Collectors.toMap(Staff::getId, Staff::getFullName));
	}

	private static TeacherDto toDto(ClassTeacher t, Map<UUID, String> names) {
		return new TeacherDto(t.getId(), t.getStaffId(), names.getOrDefault(t.getStaffId(), ""), t.getRole(),
				t.getFromDate(), t.getToDate());
	}

}
