package com.preschool.payroll.service;

import static com.preschool.common.pdf.PdfKit.cell;
import static com.preschool.common.pdf.PdfKit.money;
import static com.preschool.common.pdf.PdfKit.plain;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.preschool.common.excel.ExcelTable;
import com.preschool.common.excel.ExcelTable.Column;
import com.preschool.common.pdf.PdfKit;
import com.preschool.payroll.dto.PayrollDtos.PayrollRow;
import com.preschool.payroll.dto.PayrollDtos.PayrollSheet;
import com.preschool.payroll.dto.PayrollDtos.Payslip;
import com.preschool.staff.entity.StaffEnums.SalaryMode;

import org.springframework.stereotype.Service;

/** Phiếu lương PDF (A5) và bảng lương tháng dạng Excel. */
@Service
public class PayslipDocumentService {

	/** Tên phụ cấp theo khóa trong cấu hình lương; "seniority" là thâm niên đã quy ra tiền. */
	static final Map<String, String> ALLOWANCE_LABELS = Map.of("lunch", "Phụ cấp ăn trưa", "transport", "Phụ cấp đi lại",
			"phone", "Phụ cấp điện thoại", "responsibility", "Phụ cấp trách nhiệm", "position", "Phụ cấp chức vụ",
			"seniority", "Phụ cấp thâm niên", "other", "Phụ cấp khác");

	private final PayrollService payroll;

	public PayslipDocumentService(PayrollService payroll) {
		this.payroll = payroll;
	}

	public String pdfFileName(Payslip p) {
		return "Phieu luong %s %02d-%d.pdf".formatted(p.staffCode(), p.month().getMonthValue(), p.month().getYear());
	}

	public byte[] pdf(Payslip p) {
		Font title = new Font(PdfKit.semibold(), 14);
		Font bold = new Font(PdfKit.semibold(), 9.5f);
		Font normal = new Font(PdfKit.regular(), 9.5f);
		try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Document doc = new Document(PageSize.A5, 28, 28, 24, 24);
			PdfWriter.getInstance(doc, out);
			doc.open();
			doc.add(new Paragraph(p.schoolName(), bold));
			Paragraph heading = new Paragraph("PHIẾU LƯƠNG " + label(p.month()).toUpperCase(), title);
			heading.setAlignment(Element.ALIGN_CENTER);
			heading.setSpacingBefore(6);
			heading.setSpacingAfter(8);
			doc.add(heading);

			PdfPTable info = new PdfPTable(new float[] { 1, 1 });
			info.setWidthPercentage(100);
			info.addCell(plain("Họ tên: " + p.fullName(), normal));
			info.addCell(plain("Mã NV: " + p.staffCode(), normal));
			info.addCell(plain("Công: " + days(p.workDays()) + " / " + days(p.standardWorkDays()), normal));
			info.addCell(plain(p.salaryMode() == SalaryMode.COEFFICIENT ? "Hệ số lương: " + days(p.coefficient())
					: "Lương hợp đồng: " + money(p.contractSalary()), normal));
			info.setSpacingAfter(8);
			doc.add(info);

			PdfPTable table = new PdfPTable(new float[] { 3, 2 });
			table.setWidthPercentage(100);
			List<Object[]> lines = new ArrayList<>();
			lines.add(new Object[] { "Lương theo công", p.salaryByWork(), normal });
			p.allowances().forEach((key, value) -> lines.add(new Object[] { ALLOWANCE_LABELS.getOrDefault(key, key), value, normal }));
			if (p.bonus().signum() > 0) {
				lines.add(new Object[] { "Thưởng", p.bonus(), normal });
			}
			if (p.fines().signum() > 0) {
				lines.add(new Object[] { "Phạt", p.fines().negate(), normal });
			}
			lines.add(new Object[] { "Tổng thu nhập", p.grossSalary(), bold });
			lines.add(new Object[] { "BHXH (người lao động)", p.socialInsurance().negate(), normal });
			lines.add(new Object[] { "BHYT", p.healthInsurance().negate(), normal });
			lines.add(new Object[] { "BHTN", p.unemploymentInsurance().negate(), normal });
			lines.add(new Object[] { "Thu nhập tính thuế (giảm trừ " + p.dependentCount() + " người phụ thuộc)", p.taxableIncome(), normal });
			lines.add(new Object[] { "Thuế TNCN", p.pit().negate(), normal });
			for (Object[] line : lines) {
				table.addCell(cell((String) line[0], (Font) line[2], Element.ALIGN_LEFT));
				table.addCell(cell(money((BigDecimal) line[1]), (Font) line[2], Element.ALIGN_RIGHT));
			}
			PdfPCell netLabel = cell("THỰC LĨNH", bold, Element.ALIGN_LEFT);
			PdfPCell net = cell(money(p.netSalary()), bold, Element.ALIGN_RIGHT);
			netLabel.setBackgroundColor(new Color(240, 240, 240));
			net.setBackgroundColor(new Color(240, 240, 240));
			table.addCell(netLabel);
			table.addCell(net);
			doc.add(table);
			if (p.note() != null) {
				Paragraph note = new Paragraph("Ghi chú: " + p.note(), normal);
				note.setSpacingBefore(6);
				doc.add(note);
			}
			doc.close();
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	public byte[] excel(String month) {
		PayrollSheet sheet = payroll.sheet(month);
		List<Column> columns = List.of(new Column("Mã NV", 10), new Column("Họ tên", 26), new Column("Công", 7),
				new Column("Lương theo công", 16), new Column("Phụ cấp", 14), new Column("Thưởng", 12),
				new Column("Phạt", 12), new Column("Tổng thu nhập", 16), new Column("Bảo hiểm", 14),
				new Column("Thuế TNCN", 12), new Column("Thực lĩnh", 16), new Column("Ghi chú", 24));
		List<List<Object>> rows = new ArrayList<>();
		for (PayrollRow r : sheet.rows()) {
			rows.add(List.of(r.staffCode(), r.fullName(), r.workDays(), r.salaryByWork(), r.allowances(), r.bonus(),
					r.fines(), r.grossSalary(), r.insuranceDeduction(), r.pit(), r.netSalary(), r.note() == null ? "" : r.note()));
		}
		rows.add(List.of("", "Tổng cộng", "", "", "", "", "", sheet.totals().grossSalary(), sheet.totals().insuranceDeduction(),
				sheet.totals().pit(), sheet.totals().netSalary(), ""));
		return ExcelTable.write("Bảng lương", "Bảng lương " + label(sheet.month()), columns, rows);
	}

	public String excelFileName(String month) {
		return "bang-luong-" + month + ".xlsx";
	}

	private static String label(LocalDate month) {
		return "tháng " + month.getMonthValue() + "/" + month.getYear();
	}

	private static String days(BigDecimal value) {
		return value == null ? "—" : value.stripTrailingZeros().toPlainString().replace('.', ',');
	}

}
