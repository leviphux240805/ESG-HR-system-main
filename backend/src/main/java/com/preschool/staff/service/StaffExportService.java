package com.preschool.staff.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.StaffStatus;
import com.preschool.staff.repository.StaffContractRepository;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Xuất danh sách nhân sự ra Excel (không gồm lương, ngân hàng). */
@Service
public class StaffExportService {

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private static final Map<Position, String> POSITION_LABELS = Map.of(Position.TEACHER, "Giáo viên", Position.NANNY,
			"Bảo mẫu", Position.COOK, "Cấp dưỡng", Position.NURSE, "Nhân viên y tế", Position.ACCOUNTANT, "Kế toán",
			Position.SECURITY, "Bảo vệ", Position.MANAGER, "Quản lý", Position.OTHER, "Khác");

	private static final String[] HEADERS = { "Mã NV", "Họ tên", "Vị trí", "Cơ sở", "Số điện thoại", "Email",
			"Ngày vào làm", "Trạng thái", "Hạn hợp đồng" };

	/** Độ rộng cột (số ký tự). */
	private static final int[] COLUMN_WIDTHS = { 10, 28, 16, 24, 14, 30, 14, 12, 14 };

	private final StaffService staffService;

	private final SchoolRepository schools;

	private final StaffContractRepository contracts;

	public StaffExportService(StaffService staffService, SchoolRepository schools, StaffContractRepository contracts) {
		this.staffService = staffService;
		this.schools = schools;
		this.contracts = contracts;
	}

	@Transactional(readOnly = true)
	public byte[] export(StaffService.ListFilter filter, List<UUID> ids) {
		List<Staff> staff = staffService.listForExport(filter, ids);
		Map<UUID, String> schoolNames = schools.findAll().stream()
			.collect(Collectors.toMap(School::getId, School::getName));
		Map<UUID, LocalDate> contractEnds = new HashMap<>();
		if (!staff.isEmpty()) {
			contracts.findCurrentContractEnds(staff.stream().map(Staff::getId).toList())
				.forEach(c -> contractEnds.put(c.getStaffId(), c.getEndDate()));
		}

		try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = book.createSheet("Nhân sự");
			CellStyle headerStyle = book.createCellStyle();
			Font bold = book.createFont();
			bold.setBold(true);
			headerStyle.setFont(bold);

			Row header = sheet.createRow(0);
			for (int i = 0; i < HEADERS.length; i++) {
				Cell cell = header.createCell(i);
				cell.setCellValue(HEADERS[i]);
				cell.setCellStyle(headerStyle);
			}
			int rowIndex = 1;
			for (Staff s : staff) {
				Row row = sheet.createRow(rowIndex++);
				row.createCell(0).setCellValue(s.getStaffCode());
				row.createCell(1).setCellValue(s.getFullName());
				row.createCell(2).setCellValue(POSITION_LABELS.get(s.getPosition()));
				row.createCell(3).setCellValue(schoolNames.getOrDefault(s.getSchoolId(), ""));
				row.createCell(4).setCellValue(nullToEmpty(s.getPhone()));
				row.createCell(5).setCellValue(nullToEmpty(s.getEmail()));
				row.createCell(6).setCellValue(format(s.getStartDate()));
				row.createCell(7).setCellValue(s.getStatus() == StaffStatus.ACTIVE ? "Đang làm" : "Đã nghỉ");
				row.createCell(8).setCellValue(format(contractEnds.get(s.getId())));
			}
			// Độ rộng cố định (autoSizeColumn cần font hệ thống, dễ lỗi trên server không có giao diện)
			for (int i = 0; i < HEADERS.length; i++) {
				sheet.setColumnWidth(i, COLUMN_WIDTHS[i] * 256);
			}
			sheet.createFreezePane(0, 1);
			book.write(out);
			return out.toByteArray();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	private static String format(LocalDate date) {
		return date == null ? "" : DATE.format(date);
	}

	private static String nullToEmpty(String value) {
		return value == null ? "" : value;
	}

}
