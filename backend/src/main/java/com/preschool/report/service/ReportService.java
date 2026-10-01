package com.preschool.report.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.text.Collator;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.attendance.service.AttendanceExportService;
import com.preschool.classroom.service.ClassroomService;
import com.preschool.common.error.ApiException;
import com.preschool.common.excel.ExcelTable;
import com.preschool.common.excel.ExcelTable.Column;
import com.preschool.finance.dto.CashDtos.ReceivableRow;
import com.preschool.finance.service.InvoiceService;
import com.preschool.finance.service.InvoiceService.ReceivableFilter;
import com.preschool.report.dto.ReportDtos.Dashboard;
import com.preschool.report.dto.ReportDtos.DayRate;
import com.preschool.report.dto.ReportDtos.MonthCash;
import com.preschool.report.dto.ReportDtos.SchoolMetrics;
import com.preschool.report.dto.ReportDtos.StatusCount;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dashboard và xuất Excel báo cáo, gộp các trường đang chọn. Số liệu tổng hợp bằng SQL theo danh sách trường người
 * dùng được xem (không qua Hibernate filter nên phạm vi được truyền tường minh). Hiệu trưởng xem đủ; phó hiệu trưởng
 * theo nhóm Báo cáo (thêm nhóm Tài chính mới thấy chỉ số tài chính); kế toán chỉ thấy chỉ số tài chính.
 */
@Service
@Transactional(readOnly = true)
public class ReportService {

	/** Chỉ số vận hành: hiệu trưởng, phó hiệu trưởng nhóm Báo cáo. */
	private static final Predicate<UUID> OPERATIONS = id -> scope().manages(id, FunctionGroup.REPORTS);

	/** Chỉ số tài chính: kế toán, hoặc ban giám hiệu có cả nhóm Báo cáo và Tài chính. */
	private static final Predicate<UUID> FINANCE = id -> scope().hasRoleAt(RoleCode.ACCOUNTANT, id)
			|| (scope().manages(id, FunctionGroup.REPORTS) && scope().manages(id, FunctionGroup.FINANCE));

	/** Bảng lương: kế toán, hiệu trưởng, phó hiệu trưởng nhóm Tài chính. */
	private static final Predicate<UUID> PAYROLL = id -> scope().hasRoleAt(RoleCode.ACCOUNTANT, id)
			|| scope().manages(id, FunctionGroup.FINANCE);

	private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

	private final NamedParameterJdbcTemplate jdbc;

	private final SchoolRepository schools;

	private final ClassroomService classrooms;

	private final InvoiceService invoices;

	private final AttendanceExportService attendanceExport;

	private final Clock clock;

	public ReportService(NamedParameterJdbcTemplate jdbc, SchoolRepository schools, ClassroomService classrooms,
			InvoiceService invoices, AttendanceExportService attendanceExport, Clock clock) {
		this.jdbc = jdbc;
		this.schools = schools;
		this.classrooms = classrooms;
		this.invoices = invoices;
		this.attendanceExport = attendanceExport;
		this.clock = clock;
	}

	// ------------------------------------------------------------ dashboard

	public Dashboard dashboard(LocalDate date) {
		LocalDate day = date != null ? date : classrooms.today();
		List<UUID> ops = schoolsWith(OPERATIONS);
		List<UUID> fin = schoolsWith(FINANCE);
		List<UUID> all = new ArrayList<>(ops);
		fin.stream().filter(id -> !all.contains(id)).forEach(all::add);
		if (all.isEmpty()) {
			throw ApiException.forbidden("REPORT_FORBIDDEN", "Bạn không có quyền xem báo cáo.");
		}
		LocalDate month = day.withDayOfMonth(1);
		Map<UUID, Integer> children = Map.of();
		Map<UUID, Integer> capacity = Map.of();
		Map<UUID, Integer> present = Map.of();
		Map<UUID, Integer> absent = Map.of();
		Map<UUID, Integer> staff = Map.of();
		Map<UUID, Integer> overdueTasks = Map.of();
		Map<UUID, Integer> growthAlerts = Map.of();
		if (!ops.isEmpty()) {
			MapSqlParameterSource p = params(ops).addValue("day", Date.valueOf(day))
				.addValue("now", Timestamp.from(clock.instant()))
				.addValue("since", Date.valueOf(day.minusMonths(6)));
			children = counts("""
					SELECT school_id, count(*) FROM children
					WHERE school_id IN (:ids) AND deleted_at IS NULL AND status = 'STUDYING' GROUP BY school_id""", p);
			capacity = counts("""
					SELECT c.school_id, sum(c.capacity) FROM classes c JOIN school_years y ON y.id = c.school_year_id
					WHERE c.school_id IN (:ids) AND y.is_current GROUP BY c.school_id""", p);
			present = counts("""
					SELECT school_id, count(*) FROM child_attendance
					WHERE school_id IN (:ids) AND attend_date = :day AND status = 'PRESENT' GROUP BY school_id""", p);
			absent = counts("""
					SELECT school_id, count(*) FROM child_attendance
					WHERE school_id IN (:ids) AND attend_date = :day AND status <> 'PRESENT' GROUP BY school_id""", p);
			staff = counts("""
					SELECT school_id, count(*) FROM staff
					WHERE school_id IN (:ids) AND deleted_at IS NULL AND status = 'ACTIVE' GROUP BY school_id""", p);
			overdueTasks = counts("""
					SELECT school_id, count(*) FROM tasks
					WHERE school_id IN (:ids) AND recurrence_rule IS NULL AND status NOT IN ('DONE', 'CANCELLED') AND due_at < :now
					GROUP BY school_id""", p);
			growthAlerts = counts("""
					SELECT school_id, count(*) FROM (%s) g
					WHERE weight_status <> 'NORMAL' OR height_status <> 'NORMAL' OR bmi_status <> 'NORMAL'
					GROUP BY school_id""".formatted(LATEST_MEASUREMENTS), p);
		}
		Map<UUID, BigDecimal> receivable = Map.of();
		Map<UUID, Integer> overdueInvoices = Map.of();
		Map<UUID, BigDecimal> income = Map.of();
		Map<UUID, BigDecimal> expense = Map.of();
		if (!fin.isEmpty()) {
			MapSqlParameterSource p = params(fin).addValue("day", Date.valueOf(day))
				.addValue("from", Date.valueOf(month))
				.addValue("to", Date.valueOf(month.plusMonths(1).minusDays(1)));
			String open = "deleted_at IS NULL AND status IN ('ISSUED', 'PARTIAL') AND amount_due > amount_paid";
			receivable = sums("SELECT school_id, sum(amount_due - amount_paid) FROM invoices WHERE school_id IN (:ids) AND "
					+ open + " GROUP BY school_id", p);
			overdueInvoices = counts("SELECT school_id, count(*) FROM invoices WHERE school_id IN (:ids) AND " + open
					+ " AND due_date < :day GROUP BY school_id", p);
			income = sums("""
					SELECT school_id, sum(amount) FROM cash_entries
					WHERE school_id IN (:ids) AND direction = 'IN' AND entry_date BETWEEN :from AND :to
					GROUP BY school_id""", p);
			expense = sums("""
					SELECT school_id, sum(amount) FROM cash_entries
					WHERE school_id IN (:ids) AND direction = 'OUT' AND entry_date BETWEEN :from AND :to
					GROUP BY school_id""", p);
		}

		Map<UUID, String> names = schools.findAllByIdInOrderByCode(all)
			.stream()
			.collect(Collectors.toMap(School::getId, School::getName));
		List<SchoolMetrics> rows = new ArrayList<>();
		for (UUID id : all.stream().sorted(Comparator.comparing(i -> names.getOrDefault(i, ""))).toList()) {
			boolean o = ops.contains(id);
			boolean f = fin.contains(id);
			int kids = children.getOrDefault(id, 0);
			int here = present.getOrDefault(id, 0);
			rows.add(new SchoolMetrics(id, names.getOrDefault(id, ""), o ? kids : null,
					o ? capacity.getOrDefault(id, 0) : null, o ? here : null, o ? absent.getOrDefault(id, 0) : null,
					o ? percent(here, kids) : null, o ? staff.getOrDefault(id, 0) : null,
					o ? overdueTasks.getOrDefault(id, 0) : null, o ? growthAlerts.getOrDefault(id, 0) : null,
					f ? receivable.getOrDefault(id, BigDecimal.ZERO) : null,
					f ? overdueInvoices.getOrDefault(id, 0) : null, f ? income.getOrDefault(id, BigDecimal.ZERO) : null,
					f ? expense.getOrDefault(id, BigDecimal.ZERO) : null));
		}
		return new Dashboard(day, month, all.size() > 1, !ops.isEmpty(), !fin.isEmpty(), totals(rows), rows,
				ops.isEmpty() ? List.of() : attendanceTrend(ops, day), fin.isEmpty() ? List.of() : cashTrend(fin, month),
				ops.isEmpty() ? List.of() : nutrition(ops, day), ops.isEmpty() ? List.of() : tasks(ops));
	}

	/** Lần cân đo gần nhất trong 6 tháng của mỗi trẻ đang học. */
	private static final String LATEST_MEASUREMENTS = """
			SELECT DISTINCT ON (g.child_id) g.school_id, coalesce(g.weight_status, 'NORMAL') AS weight_status,
			       coalesce(g.height_status, 'NORMAL') AS height_status, coalesce(g.bmi_status, 'NORMAL') AS bmi_status
			FROM growth_measurements g JOIN children k ON k.id = g.child_id
			WHERE g.school_id IN (:ids) AND g.measured_on BETWEEN :since AND :day
			  AND k.deleted_at IS NULL AND k.status = 'STUDYING'
			ORDER BY g.child_id, g.measured_on DESC""";

	private static SchoolMetrics totals(List<SchoolMetrics> rows) {
		Integer kids = sumInt(rows, SchoolMetrics::children);
		Integer here = sumInt(rows, SchoolMetrics::presentToday);
		return new SchoolMetrics(null, "Toàn bộ", kids, sumInt(rows, SchoolMetrics::capacity), here,
				sumInt(rows, SchoolMetrics::absentToday), kids == null ? null : percent(here, kids),
				sumInt(rows, SchoolMetrics::staff), sumInt(rows, SchoolMetrics::overdueTasks),
				sumInt(rows, SchoolMetrics::growthAlerts), sumMoney(rows, SchoolMetrics::receivable),
				sumInt(rows, SchoolMetrics::overdueInvoices), sumMoney(rows, SchoolMetrics::income),
				sumMoney(rows, SchoolMetrics::expense));
	}

	private List<DayRate> attendanceTrend(List<UUID> ids, LocalDate day) {
		MapSqlParameterSource p = params(ids).addValue("from", Date.valueOf(day.minusDays(30)))
			.addValue("day", Date.valueOf(day));
		List<DayRate> out = jdbc.query("""
				SELECT attend_date, count(*) FILTER (WHERE status = 'PRESENT') AS present, count(*) AS marked
				FROM child_attendance WHERE school_id IN (:ids) AND attend_date BETWEEN :from AND :day
				GROUP BY attend_date ORDER BY attend_date DESC LIMIT 14""", p,
				(rs, i) -> new DayRate(rs.getDate(1).toLocalDate(), percent(rs.getInt(2), rs.getInt(3))));
		return out.reversed();
	}

	private List<MonthCash> cashTrend(List<UUID> ids, LocalDate month) {
		LocalDate from = month.minusMonths(5);
		MapSqlParameterSource p = params(ids).addValue("from", Date.valueOf(from))
			.addValue("to", Date.valueOf(month.plusMonths(1).minusDays(1)));
		Map<LocalDate, BigDecimal[]> byMonth = new LinkedHashMap<>();
		for (int i = 0; i < 6; i++) {
			byMonth.put(from.plusMonths(i), new BigDecimal[] { BigDecimal.ZERO, BigDecimal.ZERO });
		}
		jdbc.query("""
				SELECT date_trunc('month', entry_date)::date, direction, sum(amount) FROM cash_entries
				WHERE school_id IN (:ids) AND entry_date BETWEEN :from AND :to GROUP BY 1, 2""", p, rs -> {
			BigDecimal[] v = byMonth.get(rs.getDate(1).toLocalDate());
			if (v != null) {
				v["IN".equals(rs.getString(2)) ? 0 : 1] = rs.getBigDecimal(3);
			}
		});
		return byMonth.entrySet().stream().map(e -> new MonthCash(e.getKey(), e.getValue()[0], e.getValue()[1])).toList();
	}

	private List<StatusCount> nutrition(List<UUID> ids, LocalDate day) {
		MapSqlParameterSource p = params(ids).addValue("since", Date.valueOf(day.minusMonths(6)))
			.addValue("day", Date.valueOf(day));
		return jdbc.queryForObject("""
				SELECT count(*) FILTER (WHERE weight_status = 'NORMAL' AND height_status = 'NORMAL' AND bmi_status = 'NORMAL'),
				       count(*) FILTER (WHERE weight_status IN ('UNDERWEIGHT', 'SEVERE_UNDERWEIGHT')),
				       count(*) FILTER (WHERE height_status IN ('STUNTED', 'SEVERE_STUNTED')),
				       count(*) FILTER (WHERE bmi_status IN ('WASTED', 'SEVERE_WASTED')),
				       count(*) FILTER (WHERE bmi_status IN ('OVERWEIGHT', 'OBESE'))
				FROM (%s) g""".formatted(LATEST_MEASUREMENTS), p,
				(rs, i) -> List.of(new StatusCount("NORMAL", rs.getInt(1)), new StatusCount("UNDERWEIGHT", rs.getInt(2)),
						new StatusCount("STUNTED", rs.getInt(3)), new StatusCount("WASTED", rs.getInt(4)),
						new StatusCount("OVERWEIGHT", rs.getInt(5))));
	}

	private List<StatusCount> tasks(List<UUID> ids) {
		return jdbc.query("""
				SELECT status, count(*) FROM tasks WHERE school_id IN (:ids) AND recurrence_rule IS NULL
				GROUP BY status ORDER BY status""", params(ids),
				(rs, i) -> new StatusCount(rs.getString(1), rs.getInt(2)));
	}

	// ------------------------------------------------------------ xuất Excel

	public record ExportFile(String fileName, byte[] content) {
	}

	public ExportFile export(String name, String monthValue) {
		YearMonth month = parseMonth(monthValue);
		return switch (name) {
			case "staff-attendance" -> {
				AttendanceExportService.ExportFile f = attendanceExport.export(month.toString());
				yield new ExportFile(f.fileName(), f.content());
			}
			case "payroll" -> payroll(month);
			case "receivables" -> receivables();
			case "children" -> childrenList();
			default -> throw ApiException.notFound("Không có báo cáo này.");
		};
	}

	private ExportFile payroll(YearMonth month) {
		List<UUID> ids = requireSchools(PAYROLL, "Bạn không có quyền xuất bảng lương.");
		List<List<Object>> rows = jdbc.query("""
				SELECT sc.name, s.staff_code, s.full_name, r.work_days, r.gross_salary, r.insurance_deduction, r.pit,
				       r.net_salary
				FROM payroll_records r JOIN payroll_periods p ON p.id = r.period_id
				JOIN staff s ON s.id = r.staff_id JOIN schools sc ON sc.id = r.school_id
				WHERE r.school_id IN (:ids) AND p.month = :month ORDER BY sc.name, s.full_name""",
				params(ids).addValue("month", Date.valueOf(month.atDay(1))),
				(rs, i) -> List.<Object>of(rs.getString(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4),
						rs.getBigDecimal(5), rs.getBigDecimal(6), rs.getBigDecimal(7), rs.getBigDecimal(8)));
		byte[] body = ExcelTable.write("Bảng lương", "Bảng lương " + label(month),
				List.of(new Column("Cơ sở", 22), new Column("Mã NV", 12), new Column("Họ tên", 26),
						new Column("Ngày công", 11), new Column("Tổng thu nhập", 16), new Column("Bảo hiểm", 14),
						new Column("Thuế TNCN", 14), new Column("Thực lĩnh", 16)),
				rows);
		return new ExportFile("bang-luong-" + month + ".xlsx", body);
	}

	private ExportFile receivables() {
		requireSchools(FINANCE, "Bạn không có quyền xuất công nợ học phí.");
		List<ReceivableRow> list = invoices.receivableList(new ReceivableFilter(null, null, null));
		Map<UUID, String> names = schoolNames();
		List<List<Object>> rows = list.stream()
			.map(r -> List.<Object>of(names.getOrDefault(r.schoolId(), ""), nz(r.childCode()), r.childName(),
					nz(r.className()), r.invoiceCount(), r.balance(),
					r.oldestDueDate() == null ? "" : r.oldestDueDate(), r.overdueDays()))
			.toList();
		byte[] body = ExcelTable.write("Công nợ", "Công nợ học phí đến " + classrooms.today(),
				List.of(new Column("Cơ sở", 22), new Column("Mã trẻ", 12), new Column("Họ tên", 26),
						new Column("Lớp", 14), new Column("Số phiếu", 10), new Column("Còn nợ", 16),
						new Column("Hạn sớm nhất", 14), new Column("Số ngày quá hạn", 14)),
				rows);
		return new ExportFile("cong-no-hoc-phi.xlsx", body);
	}

	private ExportFile childrenList() {
		List<UUID> ids = requireSchools(OPERATIONS, "Bạn không có quyền xuất danh sách trẻ.");
		List<List<Object>> rows = jdbc.query("""
				SELECT sc.name, c.name, k.child_code, k.full_name, k.dob, k.gender, k.enrolled_at, k.allergy_note
				FROM children k JOIN schools sc ON sc.id = k.school_id
				LEFT JOIN class_enrollments e ON e.child_id = k.id AND e.to_date IS NULL
				LEFT JOIN classes c ON c.id = e.class_id
				WHERE k.school_id IN (:ids) AND k.deleted_at IS NULL AND k.status = 'STUDYING'
				""", params(ids),
				(rs, i) -> List.<Object>of(rs.getString(1), nz(rs.getString(2)), rs.getString(3), rs.getString(4),
						rs.getDate(5).toLocalDate(), "MALE".equals(rs.getString(6)) ? "Nam" : "Nữ",
						rs.getDate(7) == null ? "" : rs.getDate(7).toLocalDate(), nz(rs.getString(8))));
		Collator vi = Collator.getInstance(Locale.forLanguageTag("vi"));
		rows = rows.stream()
			.sorted(Comparator.<List<Object>, String>comparing(r -> (String) r.get(0), vi)
				.thenComparing(r -> (String) r.get(1), vi)
				.thenComparing(r -> (String) r.get(3), vi))
			.toList();
		byte[] body = ExcelTable.write("Danh sách trẻ", "Danh sách trẻ đang học đến " + classrooms.today(),
				List.of(new Column("Cơ sở", 22), new Column("Lớp", 14), new Column("Mã trẻ", 12),
						new Column("Họ tên", 26), new Column("Ngày sinh", 12), new Column("Giới tính", 10),
						new Column("Ngày nhập học", 14), new Column("Dị ứng", 30)),
				rows);
		return new ExportFile("danh-sach-tre.xlsx", body);
	}

	// ------------------------------------------------------------ hỗ trợ

	private static SchoolScope scope() {
		return SchoolScope.require();
	}

	private static List<UUID> schoolsWith(Predicate<UUID> allowed) {
		return scope().effectiveSchoolIds().stream().filter(allowed).toList();
	}

	private static List<UUID> requireSchools(Predicate<UUID> allowed, String message) {
		List<UUID> ids = schoolsWith(allowed);
		if (ids.isEmpty()) {
			throw ApiException.forbidden("REPORT_FORBIDDEN", message);
		}
		return ids;
	}

	private Map<UUID, String> schoolNames() {
		return schools.findAll().stream().collect(Collectors.toMap(School::getId, School::getName));
	}

	private static MapSqlParameterSource params(Collection<UUID> ids) {
		return new MapSqlParameterSource("ids", ids);
	}

	private Map<UUID, Integer> counts(String sql, MapSqlParameterSource p) {
		Map<UUID, Integer> out = new HashMap<>();
		jdbc.query(sql, p, rs -> {
			out.put(rs.getObject(1, UUID.class), rs.getInt(2));
		});
		return out;
	}

	private Map<UUID, BigDecimal> sums(String sql, MapSqlParameterSource p) {
		Map<UUID, BigDecimal> out = new HashMap<>();
		jdbc.query(sql, p, rs -> {
			out.put(rs.getObject(1, UUID.class), rs.getBigDecimal(2));
		});
		return out;
	}

	private static BigDecimal percent(int part, int whole) {
		return whole == 0 ? BigDecimal.ZERO
				: BigDecimal.valueOf(part).multiply(HUNDRED).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
	}

	private static Integer sumInt(List<SchoolMetrics> rows, Function<SchoolMetrics, Integer> f) {
		List<Integer> values = rows.stream().map(f).filter(Objects::nonNull).toList();
		return values.isEmpty() ? null : values.stream().mapToInt(Integer::intValue).sum();
	}

	private static BigDecimal sumMoney(List<SchoolMetrics> rows, Function<SchoolMetrics, BigDecimal> f) {
		List<BigDecimal> values = rows.stream().map(f).filter(Objects::nonNull).toList();
		return values.isEmpty() ? null : values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static YearMonth parseMonth(String value) {
		try {
			return YearMonth.parse(value);
		}
		catch (DateTimeParseException | NullPointerException ex) {
			throw ApiException.badRequest("INVALID_MONTH", "Tháng không hợp lệ (định dạng yyyy-MM).");
		}
	}

	private static String label(YearMonth m) {
		return "tháng " + m.getMonthValue() + "/" + m.getYear();
	}

	private static String nz(String s) {
		return s == null ? "" : s;
	}

}
