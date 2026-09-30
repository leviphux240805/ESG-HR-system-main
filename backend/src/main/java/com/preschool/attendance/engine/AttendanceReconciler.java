package com.preschool.attendance.engine;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Đối soát máy chấm công với bảng công chấm tay: phút đi muộn, có tính muộn không (ân hạn + số lần muộn nhẹ cho
 * phép), sai lệch, lý do và mã gợi ý. Chuyển nguyên từ {@code attendanceReconciliation.ts} của ESG HR, giữ cả cách
 * JavaScript đọc giờ (xem {@link #timeToMinutes}); test đối chiếu {@code AttendanceReconcilerParityTests} so từng trường
 * với kết quả bản cũ trên cùng dữ liệu. Thuần tính toán, không truy cập DB.
 */
public final class AttendanceReconciler {

	private static final Set<String> ABSENT_MACHINE = Set.of("K", "V");

	private static final Set<String> ABSENT_OR_SICK = Set.of("K", "V", "O", "CO");

	private static final Set<String> NOT_AT_WORK = Set.of("K", "V", "O", "CO", "TS", "T");

	private AttendanceReconciler() {
	}

	/**
	 * Tham số đối soát. Bản cũ suy giờ nghỉ trưa từ giờ vào (+4h, +5,5h) và coi thứ Bảy là ngày nửa buổi; nay lấy từ
	 * cấu hình cơ sở ({@link #legacy} cho giá trị giống bản cũ).
	 */
	public record Config(LocalTime officialStart, int graceMinutes, int maxLateAllowed, LocalTime lunchStart,
			LocalTime lunchEnd, Set<DayOfWeek> halfDayWeekdays) {

		public static Config legacy(LocalTime officialStart, int graceMinutes, int maxLateAllowed) {
			return new Config(officialStart, graceMinutes, maxLateAllowed, officialStart.plusHours(4),
					officialStart.plusMinutes(330), EnumSet.of(DayOfWeek.SATURDAY));
		}
	}

	/** Giờ máy của một người, một ngày; {@code key} là mã khớp nhân viên (mã chấm công hoặc id). */
	public record Punch(String key, LocalDate date, String checkIn, String checkOut) {
	}

	/** Mã công chấm tay hiện có. */
	public record Mark(String key, LocalDate date, String status) {
	}

	public record DayResult(String key, LocalDate date, String checkIn, String checkOut, String manualStatus,
			int lateMinutes, boolean countedLate, boolean discrepancy, String reason, String suggestedStatus) {
	}

	public record Discrepancy(boolean discrepancy, String reason, String suggestedStatus) {

		static final Discrepancy NONE = new Discrepancy(false, null, null);
	}

	// ------------------------------------------------------------ đọc giờ như JavaScript

	/**
	 * "HH:mm" → phút trong ngày theo {@code parseTimeToMinutes} cũ: rỗng/không có ":"/không bắt đầu bằng số →
	 * {@code null}; phần giờ, phút đọc như {@code Number()} (khoảng trắng bỏ qua, chuỗi rỗng = 0, sai → NaN).
	 */
	static Double timeToMinutes(String value) {
		if (value == null || value.isEmpty() || !value.contains(":") || Double.isNaN(jsParseInt(value))) {
			return null;
		}
		return hourMinute(value);
	}

	private static double hourMinute(String value) {
		String[] parts = value.split(":", -1);
		double hours = jsNumber(parts[0]);
		double minutes = parts.length > 1 ? jsNumber(parts[1]) : Double.NaN;
		return hours * 60 + minutes;
	}

	/** {@code Number(s)} của JavaScript cho chuỗi thập phân: rỗng = 0, không hợp lệ = NaN. */
	private static double jsNumber(String s) {
		String t = s.strip();
		if (t.isEmpty()) {
			return 0;
		}
		try {
			return Double.parseDouble(t);
		}
		catch (NumberFormatException ex) {
			return Double.NaN;
		}
	}

	/** {@code parseInt(s)}: bỏ khoảng trắng đầu, đọc dấu và các chữ số đầu tiên; không có số = NaN. */
	private static double jsParseInt(String s) {
		String t = s.stripLeading();
		int i = 0;
		if (i < t.length() && (t.charAt(i) == '+' || t.charAt(i) == '-')) {
			i++;
		}
		int start = i;
		while (i < t.length() && Character.isDigit(t.charAt(i))) {
			i++;
		}
		return i == start ? Double.NaN : Double.parseDouble(t.substring(0, i));
	}

	/** Số khác 0 và không NaN (điều kiện {@code if (x)} của JavaScript với số). */
	private static boolean truthy(Double value) {
		return value != null && value != 0 && !value.isNaN();
	}

	private static int minutes(LocalTime time) {
		return time.getHour() * 60 + time.getMinute();
	}

	// ------------------------------------------------------------ các hàm của bản cũ

	/** Phút đi muộn so với giờ vào chính thức; giờ không đọc được = 0. */
	public static int lateMinutes(String checkIn, LocalTime officialStart) {
		if (checkIn == null || checkIn.isEmpty() || !checkIn.contains(":")) {
			return 0;
		}
		double late = Math.max(0, hourMinute(checkIn) - minutes(officialStart));
		// Bản cũ trả NaN với giờ hỏng; ở đây coi là không muộn
		return Double.isNaN(late) ? 0 : (int) late;
	}

	/** Quá ân hạn luôn tính muộn; trong ân hạn chỉ tính khi số lần muộn nhẹ trước đó đã đạt mức cho phép. */
	public static boolean countsAsLate(int lateMinutes, int graceMinutes, int previousMinorLateCount,
			int maxLateAllowed) {
		if (lateMinutes > graceMinutes) {
			return true;
		}
		return lateMinutes > 0 && previousMinorLateCount >= maxLateAllowed;
	}

	/** Các trường hợp sai lệch 0–5 của {@code detectDiscrepancy} cũ. */
	public static Discrepancy detect(String checkIn, String checkOut, String manual, Config config,
			LocalDate workDate) {
		int start = minutes(config.officialStart());
		int startMinutes = start == 0 ? 480 : start;
		int lunchStart = config.lunchStart() != null ? minutes(config.lunchStart()) : startMinutes + 240;
		int lunchEnd = config.lunchEnd() != null ? minutes(config.lunchEnd()) : startMinutes + 330;
		int afternoonEarlyEnd = lunchEnd + 120;
		boolean halfDay = workDate != null && config.halfDayWeekdays().contains(workDate.getDayOfWeek());

		Double checkInMinutes = timeToMinutes(checkIn);
		Double checkOutMinutes = timeToMinutes(checkOut);
		boolean hasIn = checkIn != null && !checkIn.isEmpty();
		boolean hasManual = manual != null && !manual.isEmpty();

		// 0: máy ghi vắng
		if (machineAbsent(checkIn)) {
			if (hasManual && !ABSENT_OR_SICK.contains(manual)) {
				return new Discrepancy(true, "Máy: Vắng (%s), HR: %s".formatted(checkIn, manual), null);
			}
			return Discrepancy.NONE;
		}
		// 1: máy không có giờ vào nhưng HR chấm có mặt
		if (!hasIn && hasManual && !NOT_AT_WORK.contains(manual)) {
			return new Discrepancy(true, "Máy: Vắng mặt, HR: " + manual, null);
		}
		// 2: máy có mặt nhưng HR chấm vắng/nghỉ ốm
		if (hasIn && hasManual && ABSENT_OR_SICK.contains(manual)) {
			return new Discrepancy(true, "Máy: Có mặt (%s), HR: %s".formatted(checkIn, manual), null);
		}
		// 3: có giờ vào, thiếu giờ ra
		if (hasIn && (checkOut == null || checkOut.isEmpty())) {
			String reason = "Có giờ vào, thiếu giờ về - Cần xác nhận";
			if (truthy(checkInMinutes)) {
				if (checkInMinutes >= lunchEnd) {
					reason = "Có giờ vào (ca chiều), thiếu giờ về - Cần xác nhận";
				}
				else if (checkInMinutes < lunchStart) {
					reason = "Có giờ vào, thiếu giờ về - Có thể quên chấm công về";
				}
			}
			return new Discrepancy(true, reason, "X");
		}
		// 4: về trong khoảng trưa tới đầu giờ chiều → nửa ngày (trừ ngày làm nửa buổi)
		if (truthy(checkOutMinutes) && checkOutMinutes >= lunchStart && checkOutMinutes <= afternoonEarlyEnd) {
			if (halfDay) {
				return Discrepancy.NONE;
			}
			boolean halfDayStatus = hasManual && (manual.contains("1/2") || manual.contains("/2"));
			if (!halfDayStatus) {
				return new Discrepancy(true, "Về sớm (nửa ngày), HR: " + (hasManual ? manual : "Chưa chấm"), "1/2K");
			}
		}
		return Discrepancy.NONE;
	}

	// ------------------------------------------------------------ đối soát cả tháng

	/**
	 * Đối soát một tháng: mỗi (người, ngày) có giờ máy một kết quả (đếm muộn nhẹ lũy kế theo ngày tăng dần), rồi các
	 * ngày chỉ có chấm tay. Kết quả sắp theo ngày, rồi theo mã.
	 */
	public static List<DayResult> reconcile(Config config, List<Punch> punches, List<Mark> marks) {
		Map<String, String> manual = new HashMap<>();
		Map<String, Mark> manualOrder = new java.util.LinkedHashMap<>();
		for (Mark mark : marks) {
			String k = mark.key() + "|" + mark.date();
			manual.putIfAbsent(k, mark.status());
			manualOrder.putIfAbsent(k, mark);
		}

		List<Punch> ordered = new ArrayList<>(punches);
		ordered.sort(Comparator.comparing(Punch::date));
		Set<String> processed = new HashSet<>();
		Map<String, Integer> minorLateCounts = new HashMap<>();
		List<DayResult> results = new ArrayList<>();

		for (Punch punch : ordered) {
			String k = punch.key() + "|" + punch.date();
			if (!processed.add(k)) {
				continue;
			}
			String manualStatus = blankToNull(manual.get(k));
			int late = lateMinutes(punch.checkIn(), config.officialStart());
			if (late > 0 && late <= config.graceMinutes()) {
				minorLateCounts.merge(punch.key(), 1, Integer::sum);
			}
			int previousMinor = Math.max(minorLateCounts.getOrDefault(punch.key(), 0), 1) - 1;
			boolean counted = countsAsLate(late, config.graceMinutes(), previousMinor, config.maxLateAllowed());
			Discrepancy d = detect(punch.checkIn(), punch.checkOut(), manualStatus, config, punch.date());
			results.add(new DayResult(punch.key(), punch.date(), punch.checkIn(), punch.checkOut(), manualStatus, late,
					counted, d.discrepancy(), d.reason(), d.suggestedStatus()));
		}

		for (Map.Entry<String, Mark> entry : manualOrder.entrySet()) {
			if (!processed.add(entry.getKey())) {
				continue;
			}
			Mark mark = entry.getValue();
			String status = blankToNull(mark.status());
			Discrepancy d = detect(null, null, status, config, mark.date());
			results.add(new DayResult(mark.key(), mark.date(), null, null, status, 0, false, d.discrepancy(),
					d.reason(), d.suggestedStatus()));
		}

		results.sort(Comparator.comparing(DayResult::date).thenComparing(DayResult::key));
		return results;
	}

	// ------------------------------------------------------------ mã tự điền (sửa lỗi bản cũ)

	/**
	 * Mã công tự điền cho ngày chưa chấm tay sau đối soát (bản cũ để trống bảng công, và coi máy ghi K/V là X):
	 * máy ghi vắng → K; có giờ vào và giờ ra hợp lệ, không sai lệch → X; còn lại để người chấm xử lý.
	 */
	public static String autoStatus(DayResult result) {
		if (result.manualStatus() != null) {
			return null;
		}
		if (machineAbsent(result.checkIn())) {
			return "K";
		}
		if (!result.discrepancy() && truthy(timeToMinutes(result.checkIn())) && truthy(timeToMinutes(result.checkOut()))) {
			return "X";
		}
		return null;
	}

	/** Máy ghi vắng ("K"; "V" đã được đổi thành "K" khi đọc file). {@code Set.of} không nhận null nên kiểm trước. */
	private static boolean machineAbsent(String checkIn) {
		return checkIn != null && ABSENT_MACHINE.contains(checkIn);
	}

	private static String blankToNull(String value) {
		return value == null || value.isEmpty() ? null : value;
	}

	/** Mã công hợp lệ (bộ mã ESG). */
	public static final Set<String> CODES = new LinkedHashSet<>(
			List.of("X", "P", "1/2P", "K", "1/2K", "O", "CO", "TS", "T", "NL", "NB", "NN"));

}
