package com.preschool.payroll.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.attendance.entity.AttendanceConfig;
import com.preschool.attendance.entity.StaffAttendanceMonth;
import com.preschool.attendance.repository.AttendanceMonthLockRepository;
import com.preschool.attendance.repository.StaffAttendanceMonthRepository;
import com.preschool.attendance.service.AttendanceConfigService;
import com.preschool.attendance.service.AttendanceService;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.notification.service.NotificationService;
import com.preschool.payroll.dto.PayrollDtos.AdjustRequest;
import com.preschool.payroll.dto.PayrollDtos.MyPayslip;
import com.preschool.payroll.dto.PayrollDtos.ParamsDto;
import com.preschool.payroll.dto.PayrollDtos.PayrollRow;
import com.preschool.payroll.dto.PayrollDtos.PayrollSheet;
import com.preschool.payroll.dto.PayrollDtos.PayrollTotals;
import com.preschool.payroll.dto.PayrollDtos.Payslip;
import com.preschool.payroll.engine.PayrollCalculator;
import com.preschool.payroll.engine.PayrollCalculator.Bracket;
import com.preschool.payroll.engine.PayrollCalculator.Input;
import com.preschool.payroll.engine.PayrollCalculator.Result;
import com.preschool.payroll.entity.PayrollEnums.PeriodStatus;
import com.preschool.payroll.entity.PayrollParams;
import com.preschool.payroll.entity.PayrollPeriod;
import com.preschool.payroll.entity.PayrollRecord;
import com.preschool.payroll.repository.PayrollParamsRepository;
import com.preschool.payroll.repository.PayrollPeriodRepository;
import com.preschool.payroll.repository.PayrollRecordRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.SalaryMode;
import com.preschool.staff.entity.StaffSalaryConfig;
import com.preschool.staff.repository.StaffDependentRepository;
import com.preschool.staff.repository.StaffRepository;
import com.preschool.staff.repository.StaffSalaryConfigRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Bảng lương tháng của trường đang chọn: tính từ bảng công đã khóa, cấu hình lương hiệu lực trong tháng, người phụ thuộc
 * và tham số lương theo ngày hiệu lực ({@link PayrollCalculator}). Nháp → Đã duyệt (hiệu trưởng) → Đã trả; bảng đã duyệt
 * không sửa được, muốn sửa phải mở lại (kèm lý do).
 */
@Service
public class PayrollService {

	private static final TypeReference<Map<String, BigDecimal>> MONEY_MAP = new TypeReference<>() {
	};

	private static final TypeReference<List<Bracket>> BRACKETS = new TypeReference<>() {
	};

	/** Khóa phụ cấp tính theo % lương hợp đồng (thâm niên) thay vì số tiền. */
	private static final String SENIORITY_PERCENT = "seniorityPercent";

	private final PayrollPeriodRepository periods;

	private final PayrollRecordRepository records;

	private final PayrollParamsRepository params;

	private final StaffAttendanceMonthRepository attendanceMonths;

	private final AttendanceMonthLockRepository attendanceLocks;

	private final AttendanceConfigService attendanceConfigs;

	private final StaffRepository staffRepo;

	private final StaffSalaryConfigRepository salaryConfigs;

	private final StaffDependentRepository dependents;

	private final SchoolRepository schools;

	private final UserRepository users;

	private final NotificationService notifications;

	private final AuditService audit;

	private final PayrollAccess access;

	private final JsonMapper json;

	private final Clock clock;

	public PayrollService(PayrollPeriodRepository periods, PayrollRecordRepository records,
			PayrollParamsRepository params, StaffAttendanceMonthRepository attendanceMonths,
			AttendanceMonthLockRepository attendanceLocks, AttendanceConfigService attendanceConfigs,
			StaffRepository staffRepo, StaffSalaryConfigRepository salaryConfigs, StaffDependentRepository dependents,
			SchoolRepository schools, UserRepository users, NotificationService notifications, AuditService audit,
			PayrollAccess access, JsonMapper json, Clock clock) {
		this.periods = periods;
		this.records = records;
		this.params = params;
		this.attendanceMonths = attendanceMonths;
		this.attendanceLocks = attendanceLocks;
		this.attendanceConfigs = attendanceConfigs;
		this.staffRepo = staffRepo;
		this.salaryConfigs = salaryConfigs;
		this.dependents = dependents;
		this.schools = schools;
		this.users = users;
		this.notifications = notifications;
		this.audit = audit;
		this.access = access;
		this.json = json;
		this.clock = clock;
	}

	// ------------------------------------------------------------ bảng lương

	@Transactional(readOnly = true)
	public PayrollSheet sheet(String monthValue) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireEdit(schoolId);
		LocalDate month = AttendanceService.parseMonth(monthValue).atDay(1);
		return toSheet(schoolId, month, periods.findBySchoolIdAndMonth(schoolId, month).orElse(null), List.of());
	}

	/**
	 * Tính (lại) lương cả trường: cần bảng công tháng đã khóa; giữ thưởng, phạt, ghi chú đã nhập.
	 * TODO(assumption): công hưởng lương = tổng công (gồm ngày lễ) + phép năm; công chuẩn = số ngày làm việc trong tháng
	 * theo cấu hình chấm công (nửa buổi = 0,5), tính cả ngày lễ.
	 */
	@Transactional
	public PayrollSheet calculate(String monthValue) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireEdit(schoolId);
		YearMonth ym = AttendanceService.parseMonth(monthValue);
		LocalDate month = ym.atDay(1);
		if (attendanceLocks.findBySchoolIdAndMonth(schoolId, month).isEmpty()) {
			throw ApiException.conflict("ATTENDANCE_NOT_LOCKED", "Cần khóa bảng công tháng này trước khi tính lương.");
		}
		PayrollPeriod period = periods.findBySchoolIdAndMonth(schoolId, month)
			.orElseGet(() -> periods.save(new PayrollPeriod(schoolId, month, BigDecimal.ONE)));
		requireEditable(period);
		PayrollParams p = paramsAt(ym.atEndOfMonth());
		BigDecimal standard = standardWorkDays(schoolId, ym);

		Map<UUID, PayrollRecord> existing = records.findByPeriodId(period.getId())
			.stream()
			.collect(Collectors.toMap(PayrollRecord::getStaffId, Function.identity()));
		List<String> missing = new ArrayList<>();
		Set<UUID> calculated = new java.util.HashSet<>();
		for (StaffAttendanceMonth m : attendanceMonths.findBySchoolIdAndMonth(schoolId, month)) {
			Staff staff = staffRepo.findById(m.getStaffId()).orElse(null);
			Optional<StaffSalaryConfig> config = salaryConfigs.findByStaffIdOrderByEffectiveFromDesc(m.getStaffId())
				.stream()
				.filter(c -> !c.getEffectiveFrom().isAfter(ym.atEndOfMonth()))
				.findFirst();
			if (staff == null || config.isEmpty()) {
				missing.add(staff == null ? m.getStaffId().toString() : staff.getFullName());
				continue;
			}
			PayrollRecord record = existing.getOrDefault(m.getStaffId(), new PayrollRecord(schoolId, period.getId(), m.getStaffId()));
			apply(record, m.getTotalWork().add(m.getPaidLeave()), standard, config.get(), dependentCount(m.getStaffId(), month), p);
			records.save(record);
			calculated.add(m.getStaffId());
		}
		existing.values().stream().filter(r -> !calculated.contains(r.getStaffId())).forEach(records::delete);
		period.calculated(p.getId(), standard, Instant.now(clock));
		records.flush();
		audit.record("payroll.period", period.getId(), Action.UPDATE, null, Map.of("calculated", calculated.size()));
		return toSheet(schoolId, month, period, missing);
	}

	/** Sửa thưởng, phạt, ghi chú của một người; dòng đó được tính lại ngay. */
	@Transactional
	public PayrollRow adjust(UUID recordId, AdjustRequest request) {
		PayrollRecord record = records.findById(recordId)
			.filter(r -> access.canEdit(r.getSchoolId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy dòng lương."));
		PayrollPeriod period = periods.findById(record.getPeriodId()).orElseThrow();
		requireEditable(period);
		record.setAdjustments(request.bonus(), request.fines(), blankToNull(request.note()));
		YearMonth ym = YearMonth.from(period.getMonth());
		StaffSalaryConfig config = salaryConfigs.findByStaffIdOrderByEffectiveFromDesc(record.getStaffId())
			.stream()
			.filter(c -> !c.getEffectiveFrom().isAfter(ym.atEndOfMonth()))
			.findFirst()
			.orElseThrow(() -> ApiException.conflict("SALARY_CONFIG_MISSING", "Nhân viên chưa có cấu hình lương."));
		apply(record, record.getWorkDays(), period.getStandardWorkDays(), config, record.getDependentCount(),
				params.findById(period.getParamsId()).orElseGet(() -> paramsAt(ym.atEndOfMonth())));
		records.saveAndFlush(record);
		return toRow(record, staffRepo.findById(record.getStaffId()).orElseThrow());
	}

	@Transactional
	public PayrollSheet approve(String monthValue) {
		PayrollPeriod period = requirePeriod(monthValue);
		access.requireApprove(period.getSchoolId());
		requireEditable(period);
		List<PayrollRecord> rows = records.findByPeriodId(period.getId());
		if (rows.isEmpty()) {
			throw ApiException.conflict("PAYROLL_EMPTY", "Bảng lương chưa có dòng nào, hãy tính lương trước.");
		}
		period.approve(SchoolScope.require().userId(), Instant.now(clock));
		audit.record("payroll.period", period.getId(), Action.UPDATE, Map.of("status", "DRAFT"), Map.of("status", "APPROVED"));
		String label = "tháng %d/%d".formatted(period.getMonth().getMonthValue(), period.getMonth().getYear());
		for (PayrollRecord r : rows) {
			users.findByStaffId(r.getStaffId())
				.ifPresent(u -> notifications.notify(u.getId(), "PAYSLIP", "Đã có phiếu lương " + label,
						"Thực lĩnh " + com.preschool.common.pdf.PdfKit.money(r.getNetSalary()) + ".", "/cua-toi/phieu-luong",
						"payslip:" + r.getId() + ":" + period.getApprovedAt()));
		}
		return toSheet(period.getSchoolId(), period.getMonth(), period, List.of());
	}

	@Transactional
	public PayrollSheet reopen(String monthValue, String reason) {
		PayrollPeriod period = requirePeriod(monthValue);
		access.requireApprove(period.getSchoolId());
		if (period.getStatus() != PeriodStatus.APPROVED) {
			throw ApiException.conflict("PAYROLL_NOT_APPROVED", "Chỉ mở lại được bảng lương đã duyệt, chưa trả.");
		}
		period.reopen();
		audit.record("payroll.period", period.getId(), Action.UPDATE, Map.of("status", "APPROVED"),
				Map.of("status", "DRAFT", "reason", reason.trim()));
		return toSheet(period.getSchoolId(), period.getMonth(), period, List.of());
	}

	@Transactional
	public PayrollSheet pay(String monthValue) {
		PayrollPeriod period = requirePeriod(monthValue);
		access.requireEdit(period.getSchoolId());
		if (period.getStatus() != PeriodStatus.APPROVED) {
			throw ApiException.conflict("PAYROLL_NOT_APPROVED", "Bảng lương cần được duyệt trước khi trả.");
		}
		Instant now = Instant.now(clock);
		period.pay(now);
		records.findByPeriodId(period.getId()).forEach(r -> r.markPaid(now));
		audit.record("payroll.period", period.getId(), Action.UPDATE, Map.of("status", "APPROVED"), Map.of("status", "PAID"));
		return toSheet(period.getSchoolId(), period.getMonth(), period, List.of());
	}

	// ------------------------------------------------------------ phiếu lương

	/** Phiếu lương: người quản lý lương của trường, hoặc chính nhân viên khi bảng đã duyệt. */
	@Transactional(readOnly = true)
	public Payslip payslip(UUID recordId) {
		PayrollRecord r = records.findById(recordId).orElseThrow(PayrollService::payslipNotFound);
		PayrollPeriod period = periods.findById(r.getPeriodId()).orElseThrow(PayrollService::payslipNotFound);
		boolean own = r.getStaffId().equals(SchoolScope.require().access().staffId()) && period.getStatus() != PeriodStatus.DRAFT;
		if (!own && !(SchoolScope.require().canAccessSchool(r.getSchoolId()) && access.canEdit(r.getSchoolId()))) {
			throw payslipNotFound();
		}
		Staff staff = staffRepo.findById(r.getStaffId()).orElseThrow();
		return new Payslip(r.getId(), period.getMonth(), period.getStatus(), schoolName(r.getSchoolId()),
				staff.getStaffCode(), staff.getFullName(), staff.getPosition(), r.getWorkDays(),
				period.getStandardWorkDays(), r.getSalaryMode(), r.getCoefficient(), r.getContractSalary(),
				r.getSalaryByWork(), readMoney(r.getAllowancesDetail()), r.getBonus(), r.getFines(), r.getGrossSalary(),
				r.getSocialInsurance(), r.getHealthInsurance(), r.getUnemploymentInsurance(), r.getDependentCount(),
				r.getTotalDeduction(), r.getTaxableIncome(), r.getPit(), r.getNetSalary(), r.getNote());
	}

	/** Phiếu lương của tôi: chỉ bảng đã duyệt hoặc đã trả, mới nhất trước. */
	@Transactional(readOnly = true)
	public List<MyPayslip> mine() {
		UUID staffId = SchoolScope.require().access().staffId();
		if (staffId == null) {
			return List.of();
		}
		List<PayrollRecord> rows = records.findByStaffIdOrderByCreatedAtDesc(staffId);
		Map<UUID, PayrollPeriod> byId = periods.findAllById(rows.stream().map(PayrollRecord::getPeriodId).toList())
			.stream()
			.collect(Collectors.toMap(PayrollPeriod::getId, Function.identity()));
		return rows.stream()
			.filter(r -> byId.containsKey(r.getPeriodId()) && byId.get(r.getPeriodId()).getStatus() != PeriodStatus.DRAFT)
			.map(r -> {
				PayrollPeriod p = byId.get(r.getPeriodId());
				return new MyPayslip(r.getId(), p.getMonth(), schoolName(r.getSchoolId()), p.getStatus(), r.getNetSalary());
			})
			.sorted(Comparator.comparing(MyPayslip::month).reversed())
			.toList();
	}

	@Transactional(readOnly = true)
	public ParamsDto currentParams() {
		PayrollParams p = paramsAt(LocalDate.now(clock));
		return new ParamsDto(p.getEffectiveFrom(), p.getSocialInsuranceRate(), p.getHealthInsuranceRate(),
				p.getUnemploymentInsuranceRate(), p.getPersonalDeduction(), p.getDependentDeduction(), p.getBaseSalary(),
				p.getNote());
	}

	// ------------------------------------------------------------ hỗ trợ

	private void apply(PayrollRecord record, BigDecimal workDays, BigDecimal standard, StaffSalaryConfig config,
			int dependentCount, PayrollParams p) {
		Map<String, BigDecimal> allowances = new LinkedHashMap<>(readMoney(config.getAllowances()));
		BigDecimal seniorityPercent = allowances.remove(SENIORITY_PERCENT);
		BigDecimal contract = config.getSalaryMode() == SalaryMode.COEFFICIENT
				? config.getCoefficient().multiply(p.getBaseSalary()) : config.getBaseSalary();
		if (seniorityPercent != null && seniorityPercent.signum() > 0) {
			allowances.put("seniority", contract.multiply(seniorityPercent).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP));
		}
		Result r = PayrollCalculator.calculate(new Input(workDays, standard, config.getSalaryMode(), config.getBaseSalary(),
				config.getCoefficient(), config.getRegion() == null ? null : config.getRegion().name(),
				config.getInsuranceSalary(), allowances, record.getBonus(), record.getFines(), dependentCount), engineParams(p));
		record.applyCalculation(workDays, config.getSalaryMode(), r.contractSalary(), config.getCoefficient(),
				r.salaryByWork(), r.allowances(), json.writeValueAsString(r.allowancesDetail()), r.gross(),
				r.insuranceBase(), r.socialInsurance(), r.healthInsurance(), r.unemploymentInsurance(),
				r.insuranceTotal(), dependentCount, r.totalDeduction(), r.taxableIncome(), r.pit(), r.net());
	}

	private PayrollCalculator.Params engineParams(PayrollParams p) {
		return new PayrollCalculator.Params(p.getSocialInsuranceRate(), p.getHealthInsuranceRate(),
				p.getUnemploymentInsuranceRate(), p.getPersonalDeduction(), p.getDependentDeduction(), p.getBaseSalary(),
				p.getInsuranceCapMultiplier(), readMoney(p.getRegionMinWages()), json.readValue(p.getPitBrackets(), BRACKETS));
	}

	private PayrollParams paramsAt(LocalDate date) {
		return params.findByEffectiveFromLessThanEqualOrderByEffectiveFromDesc(date)
			.stream()
			.findFirst()
			.orElseThrow(() -> ApiException.conflict("PAYROLL_PARAMS_MISSING", "Chưa có tham số lương áp dụng cho tháng này."));
	}

	/** Số công chuẩn: ngày làm việc theo cấu hình chấm công (nửa buổi = 0,5), tính cả ngày lễ. */
	private BigDecimal standardWorkDays(UUID schoolId, YearMonth month) {
		BigDecimal total = BigDecimal.ZERO;
		for (LocalDate d = month.atDay(1); !d.isAfter(month.atEndOfMonth()); d = d.plusDays(1)) {
			AttendanceConfig c = attendanceConfigs.effective(schoolId, d);
			DayOfWeek w = d.getDayOfWeek();
			if (c.getWorkingWeekdays().contains(w)) {
				total = total.add(c.getHalfDayWeekdays().contains(w) ? new BigDecimal("0.5") : BigDecimal.ONE);
			}
		}
		return total;
	}

	private int dependentCount(UUID staffId, LocalDate month) {
		return (int) dependents.findByStaffIdOrderByFromMonthAsc(staffId)
			.stream()
			.filter(d -> (d.getFromMonth() == null || !d.getFromMonth().isAfter(month))
					&& (d.getToMonth() == null || !d.getToMonth().isBefore(month)))
			.count();
	}

	private PayrollPeriod requirePeriod(String monthValue) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireEdit(schoolId);
		LocalDate month = AttendanceService.parseMonth(monthValue).atDay(1);
		return periods.findBySchoolIdAndMonth(schoolId, month)
			.orElseThrow(() -> ApiException.notFound("Chưa có bảng lương tháng này."));
	}

	private static void requireEditable(PayrollPeriod period) {
		if (!period.isEditable()) {
			throw ApiException.conflict("PAYROLL_LOCKED", "Bảng lương đã duyệt, không sửa được; hiệu trưởng có thể mở lại.");
		}
	}

	private PayrollSheet toSheet(UUID schoolId, LocalDate month, PayrollPeriod period, List<String> missing) {
		List<PayrollRecord> rows = period == null ? List.of() : records.findByPeriodId(period.getId());
		Map<UUID, Staff> staff = staffRepo.findAllById(rows.stream().map(PayrollRecord::getStaffId).toList())
			.stream()
			.collect(Collectors.toMap(Staff::getId, Function.identity()));
		List<PayrollRow> dtos = rows.stream()
			.filter(r -> staff.containsKey(r.getStaffId()))
			.map(r -> toRow(r, staff.get(r.getStaffId())))
			.sorted(Comparator.comparing(PayrollRow::fullName))
			.toList();
		PayrollTotals totals = new PayrollTotals(sum(dtos, PayrollRow::grossSalary), sum(dtos, PayrollRow::insuranceDeduction),
				sum(dtos, PayrollRow::pit), sum(dtos, PayrollRow::netSalary));
		String approver = period == null || period.getApprovedBy() == null ? null
				: users.findById(period.getApprovedBy()).map(User::getFullName).orElse(null);
		return new PayrollSheet(month, schoolId, period == null ? null : period.getStatus(),
				period == null ? null : period.getStandardWorkDays(), period == null ? null : period.getCalculatedAt(),
				period == null ? null : period.getApprovedAt(), approver, period == null ? null : period.getPaidAt(),
				attendanceLocks.findBySchoolIdAndMonth(schoolId, month).isPresent(), access.canEdit(schoolId),
				access.canApprove(schoolId), dtos, missing, totals);
	}

	private static PayrollRow toRow(PayrollRecord r, Staff s) {
		return new PayrollRow(r.getId(), s.getId(), s.getStaffCode(), s.getFullName(), s.getPosition(), r.getWorkDays(),
				r.getSalaryMode(), r.getContractSalary(), r.getSalaryByWork(), r.getAllowances(), r.getBonus(),
				r.getFines(), r.getGrossSalary(), r.getInsuranceDeduction(), r.getPit(), r.getNetSalary(),
				r.getDependentCount(), r.getNote());
	}

	private Map<String, BigDecimal> readMoney(String value) {
		return value == null || value.isBlank() ? Map.of() : json.readValue(value, MONEY_MAP);
	}

	private String schoolName(UUID id) {
		return schools.findById(id).map(School::getName).orElse("");
	}

	private static BigDecimal sum(List<PayrollRow> rows, Function<PayrollRow, BigDecimal> f) {
		return rows.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static ApiException payslipNotFound() {
		return ApiException.notFound("Không tìm thấy phiếu lương.");
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

	/** Danh sách dòng lương đã tính (dùng cho xuất Excel). */
	@Transactional(readOnly = true)
	public List<PayrollRow> rowsForExport(String monthValue) {
		return sheet(monthValue).rows();
	}

}
