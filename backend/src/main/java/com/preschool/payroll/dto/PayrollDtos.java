package com.preschool.payroll.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.payroll.entity.PayrollEnums.PeriodStatus;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.SalaryMode;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Bảng lương tháng của một trường và phiếu lương. */
public final class PayrollDtos {

	private PayrollDtos() {
	}

	public record PayrollSheet(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ngày đầu tháng") LocalDate month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(description = "Rỗng = chưa tính lương tháng này") PeriodStatus status,
			BigDecimal standardWorkDays,
			Instant calculatedAt, Instant approvedAt, String approvedByName, Instant paidAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Bảng công tháng đã khóa (điều kiện tính lương)") boolean attendanceLocked,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Tính, sửa thưởng/phạt, đánh dấu đã trả") boolean canEdit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Duyệt, mở lại (hiệu trưởng)") boolean canApprove,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PayrollRow> rows,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Nhân viên chưa có cấu hình lương nên chưa tính") List<String> missingConfig,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) PayrollTotals totals) {
	}

	public record PayrollRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Position position,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal workDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SalaryMode salaryMode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal contractSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal salaryByWork,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal allowances,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal bonus,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal fines,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal grossSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal insuranceDeduction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal pit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal netSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int dependentCount,
			String note) {
	}

	public record PayrollTotals(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal grossSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal insuranceDeduction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal pit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal netSalary) {
	}

	public record AdjustRequest(
			@NotNull(message = "Nhập số tiền thưởng (0 nếu không có).") @PositiveOrZero BigDecimal bonus,
			@NotNull(message = "Nhập số tiền phạt (0 nếu không có).") @PositiveOrZero BigDecimal fines,
			@Size(max = 500) String note) {
	}

	public record ReopenRequest(@NotBlank(message = "Vui lòng nhập lý do mở lại.") @Size(max = 500) String reason) {
	}

	/** Phiếu lương chi tiết (màn hình và PDF). */
	public record Payslip(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) PeriodStatus status,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Position position,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal workDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal standardWorkDays,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SalaryMode salaryMode,
			BigDecimal coefficient,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal contractSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal salaryByWork,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Khóa phụ cấp → số tiền") Map<String, BigDecimal> allowances,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal bonus,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal fines,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal grossSalary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal socialInsurance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal healthInsurance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal unemploymentInsurance,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int dependentCount,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal totalDeduction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal taxableIncome,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal pit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal netSalary,
			String note) {
	}

	public record MyPayslip(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate month,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) PeriodStatus status,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal netSalary) {
	}

	/** Tham số lương, bảo hiểm, thuế đang áp dụng (chỉ xem; bên vận hành cập nhật). */
	public record ParamsDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate effectiveFrom,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal socialInsuranceRate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal healthInsuranceRate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal unemploymentInsuranceRate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal personalDeduction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal dependentDeduction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal baseSalary,
			String note) {
	}

}
