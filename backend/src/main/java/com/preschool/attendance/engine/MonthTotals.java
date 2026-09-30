package com.preschool.attendance.engine;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import java.util.Set;

/**
 * Tổng công tháng của một nhân viên, theo cách tính trang Chấm công ESG HR: X = 1 công; NN, 1/2P, 1/2K = 0,5 công;
 * K = 1 ngày không lương; NL, hoặc ngày lễ (là ngày làm việc) không mang mã trên = 1 công + 1 ngày lễ; P = 1 ngày
 * phép; O, CO, TS, T, NB không tính. Sửa so với bản cũ: 1/2P cộng thêm 0,5 ngày phép, 1/2K cộng 0,5 ngày không lương;
 * ngày nghỉ tuần theo cấu hình cơ sở thay cho "bỏ Chủ nhật" cố định (mã ghi vào ngày nghỉ tuần vẫn được tính).
 */
public record MonthTotals(BigDecimal totalWork, BigDecimal paidLeave, BigDecimal unpaidLeave, BigDecimal holidayLeave,
		int lateCount) {

	private static final BigDecimal ONE = BigDecimal.ONE.setScale(1);

	private static final BigDecimal HALF = new BigDecimal("0.5");

	/**
	 * @param codes mã công theo ngày (ngày không có trong map = chưa chấm)
	 * @param holidays ngày lễ áp dụng cho cơ sở trong tháng
	 * @param workingWeekdays ngày làm việc trong tuần (ngày lễ rơi vào ngày nghỉ tuần không được tính công)
	 * @param lateCount số ngày bị tính đi muộn
	 */
	public static MonthTotals compute(YearMonth month, Map<LocalDate, String> codes, Set<LocalDate> holidays,
			Set<DayOfWeek> workingWeekdays, int lateCount) {
		BigDecimal work = BigDecimal.ZERO.setScale(1);
		BigDecimal paid = BigDecimal.ZERO.setScale(1);
		BigDecimal unpaid = BigDecimal.ZERO.setScale(1);
		BigDecimal holiday = BigDecimal.ZERO.setScale(1);

		for (LocalDate day = month.atDay(1); !day.isAfter(month.atEndOfMonth()); day = day.plusDays(1)) {
			String code = codes.get(day);
			boolean holidayWorkday = holidays.contains(day) && workingWeekdays.contains(day.getDayOfWeek());
			// Thứ tự ưu tiên giữ như bản cũ: X, nửa ngày, K, rồi ngày lễ, rồi P
			if ("X".equals(code)) {
				work = work.add(ONE);
			}
			else if ("NN".equals(code)) {
				work = work.add(HALF);
			}
			else if ("1/2P".equals(code)) {
				work = work.add(HALF);
				paid = paid.add(HALF);
			}
			else if ("1/2K".equals(code)) {
				work = work.add(HALF);
				unpaid = unpaid.add(HALF);
			}
			else if ("K".equals(code)) {
				unpaid = unpaid.add(ONE);
			}
			else if ("NL".equals(code) || holidayWorkday) {
				work = work.add(ONE);
				holiday = holiday.add(ONE);
			}
			else if ("P".equals(code)) {
				paid = paid.add(ONE);
			}
			// O, CO, TS, T, NB: không cộng vào các tổng này (như bản cũ)
		}
		return new MonthTotals(work, paid, unpaid, holiday, lateCount);
	}

}
