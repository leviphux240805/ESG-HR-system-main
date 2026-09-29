package com.preschool.common.file;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Nhận dạng loại file qua vài byte đầu (magic bytes), chặn file đổi đuôi/đổi Content-Type. */
final class FileSignatures {

	/** Số byte đầu cần đọc để nhận dạng mọi loại đang hỗ trợ. */
	static final int PROBE_LENGTH = 16;

	private static final byte[] PDF = ascii("%PDF");

	private static final byte[] JPEG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };

	private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };

	private static final byte[] RIFF = ascii("RIFF");

	private static final byte[] WEBP = ascii("WEBP");

	/** docx/xlsx là file ZIP. */
	private static final byte[] ZIP = { 'P', 'K', 0x03, 0x04 };

	/** doc/xls là file OLE2. */
	private static final byte[] OLE2 = { (byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A,
			(byte) 0xE1 };

	private FileSignatures() {
	}

	static boolean matches(String mimeType, byte[] head) {
		return switch (mimeType) {
			case "application/pdf" -> startsWith(head, PDF, 0);
			case "image/jpeg" -> startsWith(head, JPEG, 0);
			case "image/png" -> startsWith(head, PNG, 0);
			case "image/webp" -> startsWith(head, RIFF, 0) && startsWith(head, WEBP, 8);
			case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ->
				startsWith(head, ZIP, 0);
			case "application/vnd.ms-excel", "application/msword" -> startsWith(head, OLE2, 0);
			// Loại được thêm vào cấu hình nhưng chưa có chữ ký: chỉ dựa vào Content-Type
			default -> true;
		};
	}

	private static boolean startsWith(byte[] data, byte[] prefix, int offset) {
		return data.length >= offset + prefix.length
				&& Arrays.equals(data, offset, offset + prefix.length, prefix, 0, prefix.length);
	}

	private static byte[] ascii(String s) {
		return s.getBytes(StandardCharsets.US_ASCII);
	}

}
