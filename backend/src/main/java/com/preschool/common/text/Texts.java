package com.preschool.common.text;

import java.text.Normalizer;

public final class Texts {

	private Texts() {
	}

	/** Bỏ dấu tiếng Việt và chữ hoa để tìm kiếm, so khớp. */
	public static String fold(String s) {
		return Normalizer.normalize(s, Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.replace('đ', 'd')
			.replace('Đ', 'D')
			.toLowerCase();
	}

}
