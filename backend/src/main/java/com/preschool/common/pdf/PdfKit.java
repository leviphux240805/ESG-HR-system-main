package com.preschool.common.pdf;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;

import com.lowagie.text.Font;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;

import org.springframework.core.io.ClassPathResource;

/** Font (Poppins nhúng, đủ dấu tiếng Việt), định dạng tiền và ô bảng dùng chung cho các file PDF. */
public final class PdfKit {

	private static BaseFont regular;

	private static BaseFont semibold;

	private PdfKit() {
	}

	public static synchronized BaseFont regular() {
		if (regular == null) {
			regular = font("fonts/poppins-regular.ttf");
		}
		return regular;
	}

	public static synchronized BaseFont semibold() {
		if (semibold == null) {
			semibold = font("fonts/poppins-semibold.ttf");
		}
		return semibold;
	}

	/** "1.500.000 đ" (font không có ký hiệu ₫). */
	public static String money(BigDecimal amount) {
		DecimalFormatSymbols symbols = new DecimalFormatSymbols();
		symbols.setGroupingSeparator('.');
		symbols.setDecimalSeparator(',');
		return new DecimalFormat("#,##0", symbols).format(amount) + " đ";
	}

	public static PdfPCell cell(String text, Font font, int align) {
		PdfPCell cell = new PdfPCell(new Phrase(text, font));
		cell.setHorizontalAlignment(align);
		cell.setPadding(4);
		return cell;
	}

	/** Ô không viền (dòng thông tin). */
	public static PdfPCell plain(String text, Font font) {
		PdfPCell cell = new PdfPCell(new Phrase(text, font));
		cell.setBorder(PdfPCell.NO_BORDER);
		cell.setPaddingBottom(3);
		return cell;
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
