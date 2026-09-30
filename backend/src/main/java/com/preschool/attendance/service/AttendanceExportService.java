package com.preschool.attendance.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

import com.preschool.attendance.dto.AttendanceDtos;
import com.preschool.attendance.dto.AttendanceDtos.DayInfo;
import com.preschool.attendance.dto.AttendanceDtos.MonthSheet;
import com.preschool.attendance.dto.AttendanceDtos.StaffRow;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.service.StaffExportService;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

/**
 * Xuất bảng công tháng ra Excel: nhân viên × ngày (mã công), tô nền ngày nghỉ tuần/ngày lễ, cột tổng.
 * TODO(assumption): bố cục tạm theo lưới trên màn hình; đổi theo mẫu bảng công chủ dự án gửi (docs/mau/).
 */
@Service
public class AttendanceExportService {

	private static final String[] WEEKDAYS = { "", "T2", "T3", "T4", "T5", "T6", "T7", "CN" };

	private static final String[] TOTAL_HEADERS = { "Tổng công", "Phép", "Không lương", "Lễ", "Đi muộn" };

	private final AttendanceService attendance;

	private final SchoolRepository schools;

	public AttendanceExportService(AttendanceService attendance, SchoolRepository schools) {
		this.attendance = attendance;
		this.schools = schools;
	}

	public record ExportFile(String fileName, byte[] content) {
	}

	public ExportFile export(String monthValue) {
		MonthSheet data = attendance.sheet(monthValue);
		YearMonth month = YearMonth.parse(data.month());
		String schoolName = schools.findById(data.schoolId()).map(s -> s.getName()).orElse("");
		List<DayInfo> days = data.days();
		int firstDayCol = 4;
		int firstTotalCol = firstDayCol + days.size();

		try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = book.createSheet("Bảng công");
			Font bold = book.createFont();
			bold.setBold(true);
			CellStyle title = book.createCellStyle();
			Font titleFont = book.createFont();
			titleFont.setBold(true);
			titleFont.setFontHeightInPoints((short) 14);
			title.setFont(titleFont);
			CellStyle header = bordered(book, IndexedColors.GREY_25_PERCENT);
			header.setFont(bold);
			header.setAlignment(HorizontalAlignment.CENTER);
			CellStyle normal = bordered(book, null);
			CellStyle center = bordered(book, null);
			center.setAlignment(HorizontalAlignment.CENTER);
			CellStyle offDay = bordered(book, IndexedColors.GREY_25_PERCENT);
			offDay.setAlignment(HorizontalAlignment.CENTER);
			CellStyle holiday = bordered(book, IndexedColors.ROSE);
			holiday.setAlignment(HorizontalAlignment.CENTER);

			Row titleRow = sheet.createRow(0);
			titleRow.createCell(0).setCellValue("BẢNG CHẤM CÔNG THÁNG %d/%d".formatted(month.getMonthValue(), month.getYear()));
			titleRow.getCell(0).setCellStyle(title);
			sheet.createRow(1).createCell(0).setCellValue(schoolName + (data.lock() != null ? " – đã khóa công" : ""));

			Row head = sheet.createRow(3);
			Row weekdayRow = sheet.createRow(4);
			String[] fixed = { "STT", "Mã NV", "Họ tên", "Vị trí" };
			for (int i = 0; i < fixed.length; i++) {
				set(head, i, fixed[i], header);
				set(weekdayRow, i, "", header);
				sheet.addMergedRegion(new CellRangeAddress(3, 4, i, i));
			}
			for (int i = 0; i < days.size(); i++) {
				DayInfo day = days.get(i);
				CellStyle style = day.holiday() != null ? holiday : day.working() ? header : offDay;
				Cell c = head.createCell(firstDayCol + i);
				c.setCellValue(day.date().getDayOfMonth());
				c.setCellStyle(style);
				set(weekdayRow, firstDayCol + i, WEEKDAYS[day.weekday()], style);
			}
			for (int i = 0; i < TOTAL_HEADERS.length; i++) {
				set(head, firstTotalCol + i, TOTAL_HEADERS[i], header);
				set(weekdayRow, firstTotalCol + i, "", header);
				sheet.addMergedRegion(new CellRangeAddress(3, 4, firstTotalCol + i, firstTotalCol + i));
			}

			int r = 5;
			for (StaffRow staff : data.staff()) {
				Row row = sheet.createRow(r);
				Cell stt = row.createCell(0);
				stt.setCellValue(r - 4);
				stt.setCellStyle(center);
				set(row, 1, staff.staffCode(), normal);
				set(row, 2, staff.fullName(), normal);
				set(row, 3, StaffExportService.POSITION_LABELS.getOrDefault(Position.valueOf(staff.position()), ""), normal);
				for (int i = 0; i < days.size(); i++) {
					DayInfo day = days.get(i);
					AttendanceDtos.Cell cell = staff.cells().get(day.date().toString());
					String code = cell == null || cell.code() == null ? "" : cell.code();
					CellStyle style = day.holiday() != null ? holiday : day.working() ? center : offDay;
					set(row, firstDayCol + i, code, style);
				}
				number(row, firstTotalCol, staff.totals().totalWork(), center);
				number(row, firstTotalCol + 1, staff.totals().paidLeave(), center);
				number(row, firstTotalCol + 2, staff.totals().unpaidLeave(), center);
				number(row, firstTotalCol + 3, staff.totals().holidayLeave(), center);
				number(row, firstTotalCol + 4, BigDecimal.valueOf(staff.totals().lateCount()), center);
				r++;
			}

			Row legend = sheet.createRow(r + 1);
			legend.createCell(2).setCellValue("X: đủ công · P: phép · 1/2P: nửa ngày phép · K: không lương · 1/2K: nửa ngày "
					+ "không lương · O: ốm · CO: con ốm · TS: thai sản · T: tai nạn · NL: lễ · NB: nghỉ bù · NN: làm nửa ngày");

			sheet.setColumnWidth(0, 5 * 256);
			sheet.setColumnWidth(1, 10 * 256);
			sheet.setColumnWidth(2, 26 * 256);
			sheet.setColumnWidth(3, 14 * 256);
			for (int i = 0; i < days.size(); i++) {
				sheet.setColumnWidth(firstDayCol + i, 5 * 256);
			}
			for (int i = 0; i < TOTAL_HEADERS.length; i++) {
				sheet.setColumnWidth(firstTotalCol + i, 11 * 256);
			}
			sheet.createFreezePane(firstDayCol, 5);

			book.write(out);
			String fileName = "Bảng công %02d-%d - %s.xlsx".formatted(month.getMonthValue(), month.getYear(), schoolName);
			return new ExportFile(fileName, out.toByteArray());
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	private static CellStyle bordered(XSSFWorkbook book, IndexedColors fill) {
		CellStyle style = book.createCellStyle();
		style.setBorderTop(BorderStyle.THIN);
		style.setBorderBottom(BorderStyle.THIN);
		style.setBorderLeft(BorderStyle.THIN);
		style.setBorderRight(BorderStyle.THIN);
		if (fill != null) {
			style.setFillForegroundColor(fill.getIndex());
			style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
		}
		return style;
	}

	private static void set(Row row, int col, String value, CellStyle style) {
		Cell cell = row.createCell(col);
		cell.setCellValue(value);
		cell.setCellStyle(style);
	}

	private static void number(Row row, int col, BigDecimal value, CellStyle style) {
		Cell cell = row.createCell(col);
		cell.setCellValue(value.doubleValue());
		cell.setCellStyle(style);
	}

}
