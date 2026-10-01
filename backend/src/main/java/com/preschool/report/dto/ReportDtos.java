package com.preschool.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

/** Dashboard các trường đang chọn. Chỉ số vận hành rỗng với người chỉ xem tài chính và ngược lại. */
public final class ReportDtos {

	private ReportDtos() {
	}

	public record SchoolMetrics(
			@Schema(description = "Rỗng ở dòng tổng các trường đang chọn") UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(description = "Trẻ đang học") Integer children,
			@Schema(description = "Tổng sĩ số tối đa các lớp năm học hiện tại") Integer capacity,
			Integer presentToday,
			Integer absentToday,
			@Schema(description = "Có mặt / trẻ đang học (%)") BigDecimal attendanceRate,
			@Schema(description = "Nhân sự đang làm") Integer staff,
			Integer overdueTasks,
			@Schema(description = "Trẻ có kênh tăng trưởng cần theo dõi (lần cân đo gần nhất trong 6 tháng)") Integer growthAlerts,
			@Schema(description = "Công nợ học phí còn phải thu") BigDecimal receivable,
			@Schema(description = "Số phiếu quá hạn còn nợ") Integer overdueInvoices,
			@Schema(description = "Tổng thu trong tháng") BigDecimal income,
			@Schema(description = "Tổng chi trong tháng") BigDecimal expense) {
	}

	public record DayRate(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Có mặt / đã điểm danh (%)") BigDecimal rate) {
	}

	public record MonthCash(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal income,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal expense) {
	}

	public record StatusCount(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int count) {
	}

	public record Dashboard(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đang xem nhiều cơ sở (so sánh giữa các cơ sở)") boolean chainView,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean showOperations,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean showFinance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SchoolMetrics totals,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<SchoolMetrics> schools,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Tỷ lệ đi học 14 ngày gần nhất có điểm danh") List<DayRate> attendanceTrend,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Thu chi 6 tháng gần nhất") List<MonthCash> cashTrend,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "NORMAL · UNDERWEIGHT · STUNTED · WASTED · OVERWEIGHT (một trẻ có thể thuộc nhiều nhóm)") List<StatusCount> nutrition,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Việc của cơ sở theo trạng thái") List<StatusCount> tasks) {
	}

}
