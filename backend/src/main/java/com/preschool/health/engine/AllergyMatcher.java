package com.preschool.health.engine;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

import com.preschool.common.text.Texts;

/**
 * So khớp ghi chú dị ứng (chữ tự do) với tên nguyên liệu/món: tách ghi chú thành từ khóa theo dấu phẩy, chấm phẩy,
 * gạch chéo, "và"; bỏ tiền tố "dị ứng", "không ăn", "kiêng"; khớp khi từ khóa xuất hiện trọn từ trong tên (không
 * phân biệt hoa thường, dấu).
 */
public final class AllergyMatcher {

	private static final Pattern SPLIT = Pattern.compile("[,;/.\\n()]+|\\s+va\\s+|\\s+hoac\\s+");

	private static final List<String> PREFIXES = List.of("di ung voi ", "di ung ", "khong an duoc ", "khong an ",
			"kieng an ", "kieng ", "khong dung ");

	private AllergyMatcher() {
	}

	public static List<String> keywords(String allergyNote) {
		if (allergyNote == null || allergyNote.isBlank()) {
			return List.of();
		}
		return Arrays.stream(SPLIT.split(normalize(allergyNote)))
			.map(String::trim)
			.map(AllergyMatcher::stripPrefix)
			.filter(k -> k.length() >= 2)
			.distinct()
			.toList();
	}

	/** Từ khóa đầu tiên khớp với {@code name}, hoặc null. */
	public static String match(List<String> keywords, String name) {
		if (name == null || keywords.isEmpty()) {
			return null;
		}
		String padded = " " + normalize(name).replaceAll("[^a-z0-9]+", " ").trim() + " ";
		return keywords.stream().filter(k -> padded.contains(" " + k + " ")).findFirst().orElse(null);
	}

	private static String normalize(String s) {
		return Texts.fold(s).replaceAll("\\s+", " ");
	}

	private static String stripPrefix(String k) {
		String out = k;
		for (String p : PREFIXES) {
			if (out.startsWith(p)) {
				out = out.substring(p.length()).trim();
			}
		}
		return out.replaceAll("[^a-z0-9 ]+", " ").replaceAll("\\s+", " ").trim();
	}

}
