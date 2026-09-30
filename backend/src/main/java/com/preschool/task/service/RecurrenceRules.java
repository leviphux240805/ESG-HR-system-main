package com.preschool.task.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.preschool.common.error.ApiException;
import com.preschool.task.dto.TaskDtos.RecurrenceDto;

/**
 * Quy tắc lặp lại: tập con của RRULE đủ cho nghiệp vụ trường mầm non — {@code FREQ=DAILY},
 * {@code FREQ=WEEKLY;BYDAY=1,3} (1 = thứ Hai), {@code FREQ=MONTHLY;BYMONTHDAY=15}, tùy chọn
 * {@code UNTIL=yyyy-MM-dd}. Lưu dạng chuỗi ở {@code tasks.recurrence_rule}; việc sinh bản việc theo lịch nằm ở
 * job của bước sau.
 */
public final class RecurrenceRules {

	private RecurrenceRules() {
	}

	/** Kiểm tra và đổi sang chuỗi lưu trong DB; trả null khi không lặp lại. */
	public static String format(RecurrenceDto dto) {
		if (dto == null) {
			return null;
		}
		List<String> parts = new ArrayList<>();
		parts.add("FREQ=" + dto.freq());
		switch (dto.freq()) {
			case "WEEKLY" -> {
				Set<Integer> days = new LinkedHashSet<>(dto.byDay() == null ? List.of() : dto.byDay());
				if (days.isEmpty()) {
					throw fieldError("recurrence.byDay", "Chọn ít nhất một thứ trong tuần");
				}
				parts.add("BYDAY=" + days.stream().sorted().map(String::valueOf).reduce((a, b) -> a + "," + b).orElseThrow());
			}
			case "MONTHLY" -> {
				if (dto.byMonthDay() == null) {
					throw fieldError("recurrence.byMonthDay", "Chọn ngày trong tháng");
				}
				parts.add("BYMONTHDAY=" + dto.byMonthDay());
			}
			case "DAILY" -> {
				// không có tham số thêm
			}
			default -> throw fieldError("recurrence.freq", "Kiểu lặp lại không hợp lệ");
		}
		if (dto.until() != null) {
			parts.add("UNTIL=" + dto.until());
		}
		return String.join(";", parts);
	}

	/** Đọc chuỗi đã lưu; chuỗi hỏng (sửa tay trong DB) coi như không lặp lại. */
	public static RecurrenceDto parse(String rule) {
		if (rule == null || rule.isBlank()) {
			return null;
		}
		Map<String, String> values = new java.util.LinkedHashMap<>();
		for (String part : rule.split(";")) {
			int eq = part.indexOf('=');
			if (eq > 0) {
				values.put(part.substring(0, eq), part.substring(eq + 1));
			}
		}
		String freq = values.get("FREQ");
		if (freq == null || !Set.of("DAILY", "WEEKLY", "MONTHLY").contains(freq)) {
			return null;
		}
		List<Integer> byDay = null;
		if (values.get("BYDAY") != null) {
			byDay = new ArrayList<>();
			for (String day : values.get("BYDAY").split(",")) {
				Integer value = toInt(day);
				if (value != null && value >= 1 && value <= 7) {
					byDay.add(value);
				}
			}
		}
		return new RecurrenceDto(freq, byDay, toInt(values.get("BYMONTHDAY")), toDate(values.get("UNTIL")));
	}

	/** Các thứ trong tuần của quy tắc WEEKLY (job sinh bản việc dùng). */
	public static Set<DayOfWeek> weekdays(RecurrenceDto dto) {
		Set<DayOfWeek> result = new LinkedHashSet<>();
		if (dto != null && dto.byDay() != null) {
			dto.byDay().forEach(day -> result.add(DayOfWeek.of(day)));
		}
		return result;
	}

	private static Integer toInt(String value) {
		try {
			return value == null ? null : Integer.valueOf(value);
		}
		catch (NumberFormatException ex) {
			return null;
		}
	}

	private static LocalDate toDate(String value) {
		try {
			return value == null ? null : LocalDate.parse(value);
		}
		catch (DateTimeParseException ex) {
			return null;
		}
	}

	private static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_ERROR", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

}
