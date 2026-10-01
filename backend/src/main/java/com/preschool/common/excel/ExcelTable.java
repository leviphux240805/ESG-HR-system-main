package com.preschool.common.excel;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * Xuất một bảng đơn giản ra Excel: dòng tiêu đề, dòng tên cột in đậm, dữ liệu (chuỗi, số có dấu phân cách nghìn,
 * ngày dd/MM/yyyy). Độ rộng cột cố định (autoSizeColumn cần font hệ thống).
 */
public final class ExcelTable {

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	public record Column(String header, int width) {
	}

	private ExcelTable() {
	}

	public static byte[] write(String sheetName, String title, List<Column> columns, List<List<Object>> rows) {
		try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = book.createSheet(sheetName);
			Font bold = book.createFont();
			bold.setBold(true);
			CellStyle titleStyle = book.createCellStyle();
			Font titleFont = book.createFont();
			titleFont.setBold(true);
			titleFont.setFontHeightInPoints((short) 14);
			titleStyle.setFont(titleFont);
			CellStyle header = book.createCellStyle();
			header.setFont(bold);
			CellStyle money = book.createCellStyle();
			money.setDataFormat(book.createDataFormat().getFormat("#,##0"));
			CellStyle decimal = book.createCellStyle();
			decimal.setDataFormat(book.createDataFormat().getFormat("#,##0.##"));

			Cell titleCell = sheet.createRow(0).createCell(0);
			titleCell.setCellValue(title);
			titleCell.setCellStyle(titleStyle);
			Row head = sheet.createRow(2);
			for (int i = 0; i < columns.size(); i++) {
				Cell cell = head.createCell(i);
				cell.setCellValue(columns.get(i).header());
				cell.setCellStyle(header);
				sheet.setColumnWidth(i, columns.get(i).width() * 256);
			}
			int r = 3;
			for (List<Object> values : rows) {
				Row row = sheet.createRow(r++);
				for (int i = 0; i < values.size(); i++) {
					Object v = values.get(i);
					Cell cell = row.createCell(i);
					if (v instanceof BigDecimal d) {
						cell.setCellValue(d.doubleValue());
						cell.setCellStyle(d.scale() > 0 ? decimal : money);
					}
					else if (v instanceof Number n) {
						cell.setCellValue(n.doubleValue());
						cell.setCellStyle(money);
					}
					else if (v instanceof LocalDate d) {
						cell.setCellValue(DATE.format(d));
					}
					else if (v != null) {
						cell.setCellValue(v.toString());
					}
				}
			}
			sheet.createFreezePane(0, 3);
			book.write(out);
			return out.toByteArray();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

}
