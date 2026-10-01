package com.preschool.health.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.classroom.repository.SchoolClassRepository;
import com.preschool.classroom.service.ChildService;
import com.preschool.classroom.service.ClassroomService;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.text.Texts;
import com.preschool.common.web.PageResponse;
import com.preschool.health.dto.HealthDtos.CheckupDto;
import com.preschool.health.dto.HealthDtos.CheckupRequest;
import com.preschool.health.dto.HealthDtos.ChildHealth;
import com.preschool.health.dto.HealthDtos.ClassMeasurementSheet;
import com.preschool.health.dto.HealthDtos.CurvePoint;
import com.preschool.health.dto.HealthDtos.GrowthChart;
import com.preschool.health.dto.HealthDtos.HealthLogDto;
import com.preschool.health.dto.HealthDtos.HealthLogRequest;
import com.preschool.health.dto.HealthDtos.MeasurementDto;
import com.preschool.health.dto.HealthDtos.MeasurementInput;
import com.preschool.health.dto.HealthDtos.MeasurementRow;
import com.preschool.health.dto.HealthDtos.SaveMeasurementsRequest;
import com.preschool.health.engine.GrowthClassifier;
import com.preschool.health.engine.GrowthClassifier.Lms;
import com.preschool.health.entity.GrowthMeasurement;
import com.preschool.health.entity.HealthCheckup;
import com.preschool.health.entity.HealthEnums.HealthLogType;
import com.preschool.health.entity.HealthEnums.Indicator;
import com.preschool.health.entity.HealthLog;
import com.preschool.health.repository.GrowthMeasurementRepository;
import com.preschool.health.repository.HealthCheckupRepository;
import com.preschool.health.repository.HealthLogRepository;
import com.preschool.security.SchoolScope;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

/**
 * Cân đo theo lớp (xếp kênh WHO ở backend), biểu đồ tăng trưởng, sổ theo dõi sức khỏe hằng ngày, khám định kỳ.
 * Giáo viên chỉ làm việc với lớp đang phụ trách; y tế, hiệu trưởng cả cơ sở.
 */
@Service
@Transactional
public class HealthService {

	private final HealthAccess access;

	private final ClassroomService classrooms;

	private final ChildService childService;

	private final ChildRepository children;

	private final ClassEnrollmentRepository enrollments;

	private final SchoolClassRepository classes;

	private final GrowthMeasurementRepository measurements;

	private final HealthLogRepository logs;

	private final HealthCheckupRepository checkups;

	private final WhoStandards standards;

	private final UserRepository users;

	private final FileService files;

	private final AuditService audit;

	private final Clock clock;

	public HealthService(HealthAccess access, ClassroomService classrooms, ChildService childService,
			ChildRepository children, ClassEnrollmentRepository enrollments, SchoolClassRepository classes,
			GrowthMeasurementRepository measurements, HealthLogRepository logs, HealthCheckupRepository checkups,
			WhoStandards standards, UserRepository users, FileService files, AuditService audit, Clock clock) {
		this.access = access;
		this.classrooms = classrooms;
		this.childService = childService;
		this.children = children;
		this.enrollments = enrollments;
		this.classes = classes;
		this.measurements = measurements;
		this.logs = logs;
		this.checkups = checkups;
		this.standards = standards;
		this.users = users;
		this.files = files;
		this.audit = audit;
		this.clock = clock;
	}

	// ------------------------------------------------------------ cân đo theo lớp

	@Transactional(readOnly = true)
	public ClassMeasurementSheet classSheet(UUID classId, LocalDate date) {
		SchoolClass c = visibleClass(classId);
		return sheet(c, date != null ? date : classrooms.today());
	}

	public ClassMeasurementSheet saveClass(UUID classId, SaveMeasurementsRequest r) {
		SchoolClass c = visibleClass(classId);
		access.requireEditClass(c.getSchoolId(), c.getId());
		if (r.date().isAfter(classrooms.today())) {
			throw ApiException.badRequest("MEASUREMENT_FUTURE", "Không nhập cân đo cho ngày trong tương lai.");
		}
		Map<UUID, Child> roster = roster(c, r.date()).stream().collect(Collectors.toMap(Child::getId, Function.identity()));
		GrowthClassifier classifier = standards.classifier();
		UUID me = access.myUserId();
		for (MeasurementInput in : r.rows()) {
			Child child = roster.get(in.childId());
			if (child == null) {
				throw ApiException.badRequest("CHILD_NOT_IN_CLASS", "Có trẻ không thuộc lớp vào ngày cân đo.");
			}
			if (r.date().isBefore(child.getDob())) {
				throw ApiException.badRequest("MEASUREMENT_BEFORE_DOB", "Ngày cân đo trước ngày sinh của trẻ.");
			}
			BigDecimal weight = in.weightKg().setScale(2, RoundingMode.HALF_UP);
			BigDecimal height = in.heightCm().setScale(1, RoundingMode.HALF_UP);
			GrowthMeasurement m = measurements.findByChildIdAndMeasuredOn(child.getId(), r.date())
				.orElseGet(() -> new GrowthMeasurement(c.getSchoolId(), child.getId(), r.date()));
			boolean created = m.getId() == null;
			m.record(c.getId(), weight, height, r.source(), blankToNull(in.note()), me,
					classifier.classify(child.getGender(), child.getDob(), r.date(), weight, height));
			measurements.save(m);
			audit.record("growth_measurements", m.getId(), created ? Action.CREATE : Action.UPDATE, null,
					Map.of("weightKg", weight, "heightCm", height, "date", r.date().toString()));
		}
		return sheet(c, r.date());
	}

	public void deleteMeasurement(UUID id) {
		GrowthMeasurement m = measurements.findById(id)
			.filter(x -> access.canViewClass(x.getSchoolId(), x.getClassId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy lần cân đo."));
		access.requireEditClass(m.getSchoolId(), m.getClassId());
		audit.record("growth_measurements", id, Action.DELETE,
				Map.of("weightKg", m.getWeightKg(), "heightCm", m.getHeightCm()), null);
		measurements.delete(m);
	}

	private ClassMeasurementSheet sheet(SchoolClass c, LocalDate date) {
		List<Child> roster = roster(c, date);
		Map<UUID, List<GrowthMeasurement>> byChild = measurements
			.findByChildIdInOrderByMeasuredOn(roster.stream().map(Child::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(GrowthMeasurement::getChildId));
		Map<UUID, String> names = userNames(byChild.values().stream().flatMap(List::stream).map(GrowthMeasurement::getRecordedBy));
		List<MeasurementRow> rows = roster.stream().map(k -> {
			List<GrowthMeasurement> list = byChild.getOrDefault(k.getId(), List.of());
			GrowthMeasurement current = list.stream().filter(m -> m.getMeasuredOn().equals(date)).findFirst().orElse(null);
			GrowthMeasurement previous = list.stream()
				.filter(m -> m.getMeasuredOn().isBefore(date))
				.reduce((a, b) -> b)
				.orElse(null);
			return new MeasurementRow(k.getId(), k.getChildCode(), k.getFullName(), k.getGender(), k.getDob(),
					toDto(current, names), toDto(previous, names));
		}).toList();
		return new ClassMeasurementSheet(c.getId(), c.getName(), date, access.canEditClass(c.getSchoolId(), c.getId()),
				rows);
	}

	private SchoolClass visibleClass(UUID classId) {
		SchoolClass c = classrooms.findVisible(classId);
		if (!access.canViewClass(c.getSchoolId(), c.getId())) {
			throw ApiException.forbidden("HEALTH_FORBIDDEN", "Bạn không có quyền xem sức khỏe trẻ của lớp này.");
		}
		return c;
	}

	private List<Child> roster(SchoolClass c, LocalDate date) {
		List<UUID> ids = enrollments.findInClassOn(c.getId(), date).stream().map(ClassEnrollment::getChildId).toList();
		return children.findAllById(ids)
			.stream()
			.filter(k -> k.getStatus() != ChildStatus.RESERVED)
			.sorted(Comparator.comparing(Child::getFullName))
			.toList();
	}

	// ------------------------------------------------------------ hồ sơ sức khỏe một trẻ

	@Transactional(readOnly = true)
	public ChildHealth childHealth(UUID childId) {
		Child child = childService.findVisible(childId);
		UUID classId = currentClassId(child.getId());
		if (!access.canViewClass(child.getSchoolId(), classId)) {
			throw ApiException.forbidden("HEALTH_FORBIDDEN", "Bạn không có quyền xem sức khỏe của trẻ này.");
		}
		List<GrowthMeasurement> list = measurements.findByChildIdOrderByMeasuredOn(childId);
		Map<UUID, String> names = userNames(list.stream().map(GrowthMeasurement::getRecordedBy));
		LocalDate today = classrooms.today();
		int ageMonths = (int) Math.ceil(ChronoUnit.DAYS.between(child.getDob(), today) / GrowthClassifier.DAYS_PER_MONTH);
		int maxMonth = Math.min(96, Math.max(24, ageMonths + 6));
		GrowthClassifier classifier = standards.classifier();
		GrowthChart chart = new GrowthChart(child.getId(), child.getFullName(), child.getGender(), child.getDob(),
				list.stream().map(m -> toDto(m, names)).toList(),
				curve(classifier, Indicator.WFA, child, maxMonth), curve(classifier, Indicator.HFA, child, maxMonth),
				curve(classifier, Indicator.BFA, child, maxMonth),
				access.canEditClass(child.getSchoolId(), classId));
		List<CheckupDto> checkupList = checkups.findByChildIdOrderByCheckupDateDesc(childId)
			.stream()
			.map(HealthService::toDto)
			.toList();
		List<HealthLogDto> recent = toLogDtos(logs.findAll(
				(root, q, cb) -> cb.equal(root.get("childId"), childId),
				PageRequest.of(0, 20, Sort.by(Sort.Order.desc("logDate"), Sort.Order.desc("createdAt")))).getContent());
		return new ChildHealth(chart, checkupList, recent, child.getAllergyNote(), child.getHealthNote(),
				access.canEditAllHealth(child.getSchoolId()));
	}

	private static List<CurvePoint> curve(GrowthClassifier classifier, Indicator indicator, Child child, int maxMonth) {
		List<CurvePoint> out = new ArrayList<>();
		for (int month = 0; month <= maxMonth; month++) {
			Lms p = classifier.lmsAt(indicator, child.getGender(),
					(int) Math.round(month * GrowthClassifier.DAYS_PER_MONTH));
			if (p != null) {
				out.add(new CurvePoint(BigDecimal.valueOf(month), sd(p, -3), sd(p, -2), sd(p, 0), sd(p, 2), sd(p, 3)));
			}
		}
		return out;
	}

	private static BigDecimal sd(Lms p, double k) {
		return BigDecimal.valueOf(GrowthClassifier.sd(p, k)).setScale(2, RoundingMode.HALF_UP);
	}

	// ------------------------------------------------------------ khám định kỳ

	public CheckupDto addCheckup(UUID childId, CheckupRequest r) {
		Child child = childService.findVisible(childId);
		requireEditAll(child.getSchoolId());
		HealthCheckup c = new HealthCheckup(child.getSchoolId(), child.getId());
		c.update(r.checkupDate(), blankToNull(r.provider()), r.summary().trim(),
				r.fileId() == null ? null : files.requireAttachable(r.fileId()).getId());
		checkups.save(c);
		audit.record("health_checkups", c.getId(), Action.CREATE, null,
				Map.of("childId", childId, "date", r.checkupDate().toString()));
		return toDto(c);
	}

	public void deleteCheckup(UUID id) {
		HealthCheckup c = checkups.findById(id)
			.filter(x -> access.canViewAllHealth(x.getSchoolId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám."));
		requireEditAll(c.getSchoolId());
		audit.record("health_checkups", id, Action.DELETE, Map.of("summary", c.getSummary()), null);
		checkups.delete(c);
	}

	@Transactional(readOnly = true)
	public DownloadUrlResponse checkupFileUrl(UUID id) {
		HealthCheckup c = checkups.findById(id)
			.filter(x -> access.canViewClass(x.getSchoolId(), currentClassId(x.getChildId())))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám."));
		StoredFile file = c.getFileId() == null ? null : files.findForModule(List.of(c.getFileId())).get(c.getFileId());
		if (file == null) {
			throw ApiException.notFound("Lần khám không có file đính kèm.");
		}
		return files.presignDownload(file, true);
	}

	private void requireEditAll(UUID schoolId) {
		if (!access.canEditAllHealth(schoolId)) {
			throw ApiException.forbidden("HEALTH_FORBIDDEN", "Chỉ y tế, hiệu trưởng ghi được kết quả khám.");
		}
	}

	// ------------------------------------------------------------ sổ theo dõi

	public record LogFilter(LocalDate from, LocalDate to, UUID classId, UUID childId, HealthLogType type, String q) {
	}

	@Transactional(readOnly = true)
	public PageResponse<HealthLogDto> logs(LogFilter filter, Pageable pageable) {
		access.requireViewAny();
		Set<UUID> fullSchools = SchoolScope.require()
			.effectiveSchoolIds()
			.stream()
			.filter(access::canViewAllHealth)
			.collect(Collectors.toSet());
		Set<UUID> myClasses = access.myClassIds();
		Specification<HealthLog> spec = (root, q, cb) -> {
			List<Predicate> scope = new ArrayList<>();
			if (!fullSchools.isEmpty()) {
				scope.add(root.get("schoolId").in(fullSchools));
			}
			if (!myClasses.isEmpty()) {
				scope.add(root.get("classId").in(myClasses));
			}
			List<Predicate> and = new ArrayList<>();
			and.add(scope.isEmpty() ? cb.disjunction() : cb.or(scope.toArray(Predicate[]::new)));
			if (filter.from() != null) {
				and.add(cb.greaterThanOrEqualTo(root.get("logDate"), filter.from()));
			}
			if (filter.to() != null) {
				and.add(cb.lessThanOrEqualTo(root.get("logDate"), filter.to()));
			}
			if (filter.classId() != null) {
				and.add(cb.equal(root.get("classId"), filter.classId()));
			}
			if (filter.childId() != null) {
				and.add(cb.equal(root.get("childId"), filter.childId()));
			}
			if (filter.type() != null) {
				and.add(cb.equal(root.get("type"), filter.type()));
			}
			return cb.and(and.toArray(Predicate[]::new));
		};
		List<HealthLogDto> rows = toLogDtos(
				logs.findAll(spec, Sort.by(Sort.Order.desc("logDate"), Sort.Order.desc("createdAt"))));
		String q = filter.q() == null ? "" : Texts.fold(filter.q().trim());
		if (!q.isEmpty()) {
			rows = rows.stream()
				.filter(l -> Texts.fold(l.childName()).contains(q) || Texts.fold(l.content()).contains(q))
				.toList();
		}
		return PageResponse.slice(rows, pageable);
	}

	public HealthLogDto createLog(HealthLogRequest r) {
		Child child = childService.findVisible(r.childId());
		UUID classId = currentClassId(child.getId());
		access.requireEditClass(child.getSchoolId(), classId);
		HealthLog log = new HealthLog(child.getSchoolId(), child.getId(), classId, access.myUserId());
		applyLog(log, r);
		logs.save(log);
		audit.record("health_logs", log.getId(), Action.CREATE, null, Map.of("type", r.type(), "childId", r.childId()));
		return toLogDtos(List.of(log)).getFirst();
	}

	public HealthLogDto updateLog(UUID id, HealthLogRequest r) {
		HealthLog log = editableLog(id);
		if (!log.getChildId().equals(r.childId())) {
			throw ApiException.badRequest("HEALTH_LOG_CHILD", "Không đổi được trẻ của ghi chép.");
		}
		Map<String, Object> before = Map.of("content", log.getContent(), "type", log.getType());
		applyLog(log, r);
		audit.record("health_logs", id, Action.UPDATE, before, Map.of("content", log.getContent(), "type", log.getType()));
		return toLogDtos(List.of(log)).getFirst();
	}

	public HealthLogDto notifyParent(UUID id) {
		HealthLog log = editableLog(id);
		if (log.getParentNotifiedAt() == null) {
			log.markParentNotified(clock.instant(), access.myUserId());
			audit.record("health_logs", id, Action.UPDATE, null, Map.of("parentNotified", true));
		}
		return toLogDtos(List.of(log)).getFirst();
	}

	public void deleteLog(UUID id) {
		HealthLog log = editableLog(id);
		audit.record("health_logs", id, Action.DELETE, Map.of("content", log.getContent()), null);
		logs.delete(log);
	}

	private void applyLog(HealthLog log, HealthLogRequest r) {
		if (r.logDate().isAfter(classrooms.today())) {
			throw ApiException.badRequest("HEALTH_LOG_FUTURE", "Không ghi sổ cho ngày trong tương lai.");
		}
		log.update(r.logDate(), r.type(), r.content().trim(), r.temperatureC());
		if (Boolean.TRUE.equals(r.parentNotified()) && log.getParentNotifiedAt() == null) {
			log.markParentNotified(clock.instant(), access.myUserId());
		}
		else if (Boolean.FALSE.equals(r.parentNotified())) {
			log.markParentNotified(null, null);
		}
	}

	private HealthLog editableLog(UUID id) {
		HealthLog log = logs.findById(id)
			.filter(l -> access.canViewClass(l.getSchoolId(), l.getClassId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy ghi chép."));
		access.requireEditClass(log.getSchoolId(), log.getClassId());
		return log;
	}

	private List<HealthLogDto> toLogDtos(List<HealthLog> list) {
		Map<UUID, Child> childById = children.findAllById(list.stream().map(HealthLog::getChildId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Child::getId, Function.identity()));
		Map<UUID, String> classNames = classes
			.findByIdIn(list.stream().map(HealthLog::getClassId).filter(Objects::nonNull).collect(Collectors.toSet()))
			.stream()
			.collect(Collectors.toMap(SchoolClass::getId, SchoolClass::getName));
		Map<UUID, String> names = userNames(
				list.stream().flatMap(l -> Stream.of(l.getRecordedBy(), l.getParentNotifiedBy())));
		return list.stream().map(l -> {
			Child k = childById.get(l.getChildId());
			return new HealthLogDto(l.getId(), l.getChildId(), k == null ? "" : k.getFullName(), l.getClassId(),
					classNames.get(l.getClassId()), l.getLogDate(), l.getType(), l.getContent(), l.getTemperatureC(),
					l.getParentNotifiedAt(), names.get(l.getParentNotifiedBy()), names.get(l.getRecordedBy()),
					access.canEditClass(l.getSchoolId(), l.getClassId()));
		}).toList();
	}

	// ------------------------------------------------------------ hỗ trợ

	private UUID currentClassId(UUID childId) {
		return enrollments.findByChildIdAndToDateIsNull(childId).map(ClassEnrollment::getClassId).orElse(null);
	}

	private Map<UUID, String> userNames(Stream<UUID> ids) {
		Collection<UUID> distinct = ids.filter(Objects::nonNull).collect(Collectors.toCollection(HashSet::new));
		if (distinct.isEmpty()) {
			return Map.of();
		}
		Map<UUID, String> out = new HashMap<>();
		for (User u : users.findAllById(distinct)) {
			out.put(u.getId(), u.getFullName());
		}
		return out;
	}

	private static MeasurementDto toDto(GrowthMeasurement m, Map<UUID, String> names) {
		if (m == null) {
			return null;
		}
		return new MeasurementDto(m.getId(), m.getChildId(), m.getMeasuredOn(), m.getWeightKg(), m.getHeightCm(),
				m.getAgeMonths(), m.getBmi(), m.getWeightZ(), m.getHeightZ(), m.getBmiZ(), m.getWeightStatus(),
				m.getHeightStatus(), m.getBmiStatus(), m.getStandard(), m.getSource(), m.getNote(),
				names.get(m.getRecordedBy()));
	}

	private static CheckupDto toDto(HealthCheckup c) {
		return new CheckupDto(c.getId(), c.getChildId(), c.getCheckupDate(), c.getProvider(), c.getSummary(),
				c.getFileId());
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

}
