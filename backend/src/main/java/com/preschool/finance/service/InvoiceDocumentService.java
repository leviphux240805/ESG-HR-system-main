package com.preschool.finance.service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.preschool.finance.dto.InvoiceDtos.InvoiceDetail;
import com.preschool.finance.dto.InvoiceDtos.InvoiceLineDto;
import com.preschool.finance.dto.InvoiceDtos.InvoiceRow;
import com.preschool.finance.dto.InvoiceDtos.PaymentDto;
import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.entity.FinanceEnums.PaymentMethod;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Phiếu thu dạng PDF (in đưa phụ huynh) và danh sách phiếu thu tháng dạng Excel. */
@Service
@Transactional(readOnly = true)
public class InvoiceDocumentService {

	public static final Map<InvoiceStatus, String> STATUS_LABELS = Map.of(InvoiceStatus.DRAFT, "Nháp",
			InvoiceStatus.ISSUED, "Chưa thu", InvoiceStatus.PARTIAL, "Thu một phần", InvoiceStatus.PAID, "Đã thu đủ",
			InvoiceStatus.CARRIED, "Đã chuyển nợ", InvoiceStatus.CANCELLED, "Đã hủy");

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private static final String[] HEADERS = { "Số phiếu", "Mã trẻ", "Họ tên", "Lớp", "Tổng khoản thu", "Miễn giảm",
			"Hoàn tiền ăn", "Số dư kỳ trước", "Phải thu", "Đã thu", "Còn lại", "Trạng thái", "Hạn nộp" };

	private static final int[] COLUMN_WIDTHS = { 16, 12, 28, 14, 16, 14, 14, 16, 16, 16, 16, 16, 12 };

	private final InvoiceService invoices;

	private final SchoolRepository schools;

	private BaseFont regular;

	private BaseFont semibold;

	public InvoiceDocumentService(InvoiceService invoices, SchoolRepository schools) {
		this.invoices = invoices;
		this.schools = schools;
	}

	public String pdfFileName(UUID id) {
		InvoiceRow row = invoices.detail(id).invoice();
		return "Phieu thu " + (row.invoiceNo() == null ? "nhap" : row.invoiceNo()) + ".pdf";
	}

	public byte[] pdf(UUID id) {
		InvoiceDetail detail = invoices.detail(id);
		InvoiceRow row = detail.invoice();
		School school = schools.findById(row.schoolId()).orElseThrow();
		Font title = new Font(semibold(), 15);
		Font bold = new Font(semibold(), 10);
		Font normal = new Font(regular(), 10);
		Font small = new Font(regular(), 8, Font.NORMAL, Color.DARK_GRAY);

		try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Document doc = new Document(PageSize.A5.rotate(), 28, 28, 24, 24);
			PdfWriter.getInstance(doc, out);
			doc.open();
			doc.add(new Paragraph(school.getName(), bold));
			if (school.getPhone() != null) {
				doc.add(new Paragraph("Điện thoại: " + school.getPhone(), small));
			}
			Paragraph heading = new Paragraph(
					"PHIẾU THU HỌC PHÍ " + monthLabel(row.periodMonth()).toUpperCase()
							+ (row.status() == InvoiceStatus.DRAFT ? " (NHÁP)" : ""),
					title);
			heading.setAlignment(Element.ALIGN_CENTER);
			heading.setSpacingBefore(6);
			doc.add(heading);
			Paragraph no = new Paragraph("Số: " + (row.invoiceNo() == null ? "—" : row.invoiceNo()), normal);
			no.setAlignment(Element.ALIGN_CENTER);
			no.setSpacingAfter(8);
			doc.add(no);

			PdfPTable info = new PdfPTable(new float[] { 1, 1 });
			info.setWidthPercentage(100);
			info.addCell(plain("Họ tên trẻ: " + row.childName()
					+ (row.childCode() == null ? "" : " (" + row.childCode() + ")"), normal));
			info.addCell(plain("Lớp: " + (row.className() == null ? "—" : row.className()), normal));
			info.addCell(plain("Hạn nộp: " + (row.dueDate() == null ? "—" : DATE.format(row.dueDate())), normal));
			info.addCell(plain("Trạng thái: " + STATUS_LABELS.get(row.status()), normal));
			info.setSpacingAfter(8);
			doc.add(info);

			PdfPTable lines = new PdfPTable(new float[] { 4.2f, 1, 2, 2.2f, 3 });
			lines.setWidthPercentage(100);
			for (String h : new String[] { "Khoản", "SL", "Đơn giá", "Thành tiền", "Ghi chú" }) {
				PdfPCell cell = new PdfPCell(new Phrase(h, bold));
				cell.setBackgroundColor(new Color(240, 240, 240));
				cell.setPadding(4);
				lines.addCell(cell);
			}
			for (InvoiceLineDto l : detail.lines()) {
				lines.addCell(cell(l.description(), normal, Element.ALIGN_LEFT));
				lines.addCell(cell(quantity(l.quantity()), normal, Element.ALIGN_RIGHT));
				lines.addCell(cell(money(l.unitPrice()), normal, Element.ALIGN_RIGHT));
				lines.addCell(cell(money(l.amount()), normal, Element.ALIGN_RIGHT));
				lines.addCell(cell(l.note() == null ? "" : l.note(), small, Element.ALIGN_LEFT));
			}
			total(lines, "Phải thu", row.amountDue(), bold);
			total(lines, "Đã thu", row.amountPaid(), normal);
			total(lines, row.balance().signum() < 0 ? "Trả thừa" : "Còn phải thu", row.balance().abs(), bold);
			doc.add(lines);

			List<PaymentDto> paid = detail.payments().stream().filter(p -> p.voidedAt() == null).toList();
			if (!paid.isEmpty()) {
				Paragraph p = new Paragraph("Các lần thu:", bold);
				p.setSpacingBefore(8);
				doc.add(p);
				for (PaymentDto pay : paid) {
					doc.add(new Paragraph("• " + DATE.format(pay.paidOn()) + " – " + money(pay.amount()) + " ("
							+ (pay.method() == PaymentMethod.CASH ? "tiền mặt" : "chuyển khoản") + ")", normal));
				}
			}
			Paragraph sign = new Paragraph("Người thu tiền", bold);
			sign.setAlignment(Element.ALIGN_RIGHT);
			sign.setSpacingBefore(14);
			doc.add(sign);
			doc.close();
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	public byte[] excel(InvoiceService.ListFilter filter) {
		List<InvoiceRow> rows = invoices.rows(filter);
		try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = book.createSheet("Phiếu thu");
			CellStyle headerStyle = book.createCellStyle();
			org.apache.poi.ss.usermodel.Font boldFont = book.createFont();
			boldFont.setBold(true);
			headerStyle.setFont(boldFont);
			CellStyle moneyStyle = book.createCellStyle();
			moneyStyle.setDataFormat(book.createDataFormat().getFormat("#,##0"));

			Row header = sheet.createRow(0);
			for (int i = 0; i < HEADERS.length; i++) {
				Cell cell = header.createCell(i);
				cell.setCellValue(HEADERS[i]);
				cell.setCellStyle(headerStyle);
			}
			int r = 1;
			for (InvoiceRow row : rows) {
				Row x = sheet.createRow(r++);
				x.createCell(0).setCellValue(row.invoiceNo() == null ? "" : row.invoiceNo());
				x.createCell(1).setCellValue(row.childCode() == null ? "" : row.childCode());
				x.createCell(2).setCellValue(row.childName());
				x.createCell(3).setCellValue(row.className() == null ? "" : row.className());
				BigDecimal[] amounts = { row.subtotal(), row.discount(), row.refund(), row.carriedBalance(),
						row.amountDue(), row.amountPaid(), row.balance() };
				for (int i = 0; i < amounts.length; i++) {
					Cell cell = x.createCell(4 + i);
					cell.setCellValue(amounts[i].doubleValue());
					cell.setCellStyle(moneyStyle);
				}
				x.createCell(11).setCellValue(STATUS_LABELS.get(row.status()));
				x.createCell(12).setCellValue(row.dueDate() == null ? "" : DATE.format(row.dueDate()));
			}
			for (int i = 0; i < HEADERS.length; i++) {
				sheet.setColumnWidth(i, COLUMN_WIDTHS[i] * 256);
			}
			sheet.createFreezePane(0, 1);
			book.write(out);
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	public static String monthLabel(LocalDate month) {
		return "Tháng " + month.getMonthValue() + "/" + month.getYear();
	}

	private static void total(PdfPTable table, String label, BigDecimal amount, Font font) {
		PdfPCell name = cell(label, font, Element.ALIGN_RIGHT);
		name.setColspan(3);
		table.addCell(name);
		table.addCell(cell(money(amount), font, Element.ALIGN_RIGHT));
		table.addCell(cell("", font, Element.ALIGN_LEFT));
	}

	private static PdfPCell cell(String text, Font font, int align) {
		PdfPCell cell = new PdfPCell(new Phrase(text, font));
		cell.setHorizontalAlignment(align);
		cell.setPadding(4);
		return cell;
	}

	private static PdfPCell plain(String text, Font font) {
		PdfPCell cell = new PdfPCell(new Phrase(text, font));
		cell.setBorder(PdfPCell.NO_BORDER);
		cell.setPaddingBottom(3);
		return cell;
	}

	/** "1.500.000 đ" (font PDF không có ký hiệu ₫). */
	static String money(BigDecimal amount) {
		DecimalFormatSymbols symbols = new DecimalFormatSymbols();
		symbols.setGroupingSeparator('.');
		symbols.setDecimalSeparator(',');
		return new DecimalFormat("#,##0", symbols).format(amount) + " đ";
	}

	private static String quantity(BigDecimal q) {
		return q.stripTrailingZeros().toPlainString().replace('.', ',');
	}

	private synchronized BaseFont regular() {
		if (regular == null) {
			regular = font("fonts/poppins-regular.ttf");
		}
		return regular;
	}

	private synchronized BaseFont semibold() {
		if (semibold == null) {
			semibold = font("fonts/poppins-semibold.ttf");
		}
		return semibold;
	}

	private static BaseFont font(String path) {
		try (InputStream in = new ClassPathResource(path).getInputStream()) {
			return BaseFont.createFont(path, BaseFont.IDENTITY_H, BaseFont.EMBEDDED, true, in.readAllBytes(), null);
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

}
