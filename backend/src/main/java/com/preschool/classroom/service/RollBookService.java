package com.preschool.classroom.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.attendance.service.AttendanceService;
import com.preschool.classroom.dto.RollBookDtos.RollBook;
import com.preschool.classroom.dto.RollBookDtos.RollBookDay;
import com.preschool.classroom.dto.RollBookDtos.RollBookRow;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ChildAttendance;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.ChildAttendanceRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.common.excel.ExcelTable;
import com.preschool.common.excel.ExcelTable.Column;
import com.preschool.school.entity.Holiday;
import com.preschool.school.repository.HolidayRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sổ điểm danh tháng: trẻ × ngày lấy từ điểm danh hằng ngày (C có mặt, P vắng có phép, K vắng không phép), tổng theo
 * trẻ và theo ngày. Sửa ô đi qua {@link ChildAttendanceService#mark} nên giữ nguyên quyền, giờ báo ăn, ngày đã chốt.
 */
@Service
@Transactional(readOnly = true)
public class RollBookService {

	private static final Map<AttendanceStatus, String> CODE = Map.of(AttendanceStatus.PRESENT, "C",
			AttendanceStatus.EXCUSED, "P", AttendanceStatus.ABSENT, "K");

	private final ClassroomService classroom;

	private final ChildAttendanceService childAttendance;

	private final ChildAttendanceRepository attendance;

	private final ClassEnrollmentRepository enrollments;

	private final ChildRepository children;

	private final HolidayRepository holidays;

	public RollBookService(ClassroomService classroom, ChildAttendanceService childAttendance,
			ChildAttendanceRepository attendance, ClassEnrollmentRepository enrollments, ChildRepository children,
			HolidayRepository holidays) {
		this.classroom = classroom;
		this.childAttendance = childAttendance;
		this.attendance = attendance;
		this.enrollments = enrollments;
		this.children = children;
		this.holidays = holidays;
	}

	public RollBook rollBook(UUID classId, String monthValue) {
		SchoolClass c = classroom.findVisible(classId);
		YearMonth month = AttendanceService.parseMonth(monthValue);
		LocalDate from = month.atDay(1);
		LocalDate to = month.atEndOfMonth();
		LocalDate today = classroom.today();

		List<ChildAttendance> marks = attendance.findByClassIdAndAttendDateBetween(c.getId(), from, to);
		Map<UUID, Map<LocalDate, ChildAttendance>> byChild = marks.stream()
			.collect(Collectors.groupingBy(ChildAttendance::getChildId,
					Collectors.toMap(ChildAttendance::getAttendDate, Function.identity())));
		Set<LocalDate> lockedDays = marks.stream()
			.filter(ChildAttendance::isLocked)
			.map(ChildAttendance::getAttendDate)
			.collect(Collectors.toSet());
		Map<LocalDate, String> holidayNames = holidays.findByHolidayDateBetweenOrderByHolidayDate(from, to)
			.stream()
			.filter(h -> h.getSchoolId() == null || h.getSchoolId().equals(c.getSchoolId()))
			.collect(Collectors.toMap(Holiday::getHolidayDate, Holiday::getName, (a, b) -> a));

		List<RollBookDay> days = new ArrayList<>();
		Set<LocalDate> pastSchoolDays = new java.util.HashSet<>();
		for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
			LocalDate day = d;
			boolean schoolDay = childAttendance.isSchoolDay(c.getSchoolId(), day);
			if (schoolDay && !day.isAfter(today)) {
				pastSchoolDays.add(day);
			}
			boolean locked = lockedDays.contains(day);
			List<AttendanceStatus> statuses = marks.stream().filter(m -> m.getAttendDate().equals(day)).map(ChildAttendance::getStatus).toList();
			days.add(new RollBookDay(day, day.getDayOfWeek().getValue(), schoolDay, holidayNames.get(day), locked,
					schoolDay && childAttendance.editBlock(c, day, locked) == null, count(statuses, AttendanceStatus.PRESENT),
					count(statuses, AttendanceStatus.EXCUSED), count(statuses, AttendanceStatus.ABSENT)));
		}

		// Mỗi trẻ một dòng; nhiều đợt học trong tháng thì gộp khoảng [ngày đầu, ngày cuối]
		Map<UUID, LocalDate[]> ranges = new LinkedHashMap<>();
		for (ClassEnrollment e : enrollments.findInClassBetween(c.getId(), from, to)) {
			LocalDate start = e.getFromDate().isBefore(from) ? from : e.getFromDate();
			LocalDate end = e.getToDate() == null || e.getToDate().isAfter(to) ? to : e.getToDate();
			ranges.merge(e.getChildId(), new LocalDate[] { start, end }, (a, b) -> new LocalDate[] {
					a[0].isBefore(b[0]) ? a[0] : b[0], a[1].isAfter(b[1]) ? a[1] : b[1] });
		}
		List<RollBookRow> rows = children.findAllById(ranges.keySet())
			.stream()
			.filter(k -> k.getStatus() != ChildStatus.RESERVED || byChild.containsKey(k.getId()))
			.sorted(Comparator.comparing(Child::getFullName))
			.map(k -> row(k, ranges.get(k.getId()), byChild.getOrDefault(k.getId(), Map.of()), pastSchoolDays))
			.toList();
		return new RollBook(c.getId(), c.getName(), c.getSchoolId(), from, days, rows);
	}

	public byte[] export(UUID classId, String monthValue) {
		RollBook book = rollBook(classId, monthValue);
		List<Column> columns = new ArrayList<>(List.of(new Column("Mã trẻ", 10), new Column("Họ tên", 26)));
		book.days().forEach(d -> columns.add(new Column(String.valueOf(d.date().getDayOfMonth()), 4)));
		columns.addAll(List.of(new Column("Có mặt", 8), new Column("P", 5), new Column("K", 5), new Column("Chuyên cần (%)", 13)));
		List<List<Object>> rows = new ArrayList<>();
		for (RollBookRow r : book.rows()) {
			List<Object> line = new ArrayList<>(List.of(r.code(), r.fullName()));
			book.days().forEach(d -> line.add(r.cells().containsKey(d.date()) ? CODE.get(r.cells().get(d.date())) : ""));
			line.addAll(List.of(r.present(), r.excused(), r.absent(), r.rate()));
			rows.add(line);
		}
		List<Object> totals = new ArrayList<>(List.of("", "Có mặt theo ngày"));
		book.days().forEach(d -> totals.add(d.schoolDay() ? d.present() : ""));
		totals.addAll(List.of(sum(book.rows(), RollBookRow::present), sum(book.rows(), RollBookRow::excused),
				sum(book.rows(), RollBookRow::absent), ""));
		rows.add(totals);
		YearMonth month = YearMonth.from(book.month());
		return ExcelTable.write("Sổ điểm danh", "Sổ điểm danh lớp %s tháng %d/%d".formatted(book.className(),
				month.getMonthValue(), month.getYear()), columns, rows);
	}

	public String fileName(UUID classId, String monthValue) {
		return "so-diem-danh-%s-%s.xlsx".formatted(classroom.findVisible(classId).getName().replaceAll("\\s+", "-"),
				AttendanceService.parseMonth(monthValue));
	}

	private static RollBookRow row(Child k, LocalDate[] range, Map<LocalDate, ChildAttendance> marks,
			Set<LocalDate> pastSchoolDays) {
		Map<LocalDate, AttendanceStatus> cells = new LinkedHashMap<>();
		Map<LocalDate, String> notes = new LinkedHashMap<>();
		marks.values().stream().sorted(Comparator.comparing(ChildAttendance::getAttendDate)).forEach(m -> {
			cells.put(m.getAttendDate(), m.getStatus());
			if (m.getNote() != null) {
				notes.put(m.getAttendDate(), m.getNote());
			}
		});
		int present = count(cells.values(), AttendanceStatus.PRESENT);
		long expected = pastSchoolDays.stream().filter(d -> !d.isBefore(range[0]) && !d.isAfter(range[1])).count();
		BigDecimal rate = expected == 0 ? BigDecimal.ZERO
				: BigDecimal.valueOf(present * 100L).divide(BigDecimal.valueOf(expected), 1, RoundingMode.HALF_UP);
		return new RollBookRow(k.getId(), k.getChildCode(), k.getFullName(), range[0], range[1], cells, notes, present,
				count(cells.values(), AttendanceStatus.EXCUSED), count(cells.values(), AttendanceStatus.ABSENT), rate);
	}

	private static int count(Collection<AttendanceStatus> statuses, AttendanceStatus status) {
		return (int) statuses.stream().filter(s -> s == status).count();
	}

	private static int sum(List<RollBookRow> rows, java.util.function.ToIntFunction<RollBookRow> f) {
		return rows.stream().mapToInt(f).sum();
	}

}
