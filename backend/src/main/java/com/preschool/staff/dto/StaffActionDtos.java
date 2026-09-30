package com.preschool.staff.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.preschool.common.audit.AuditLog;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;
import com.preschool.staff.entity.StaffEnums.SalaryMode;
import com.preschool.staff.entity.StaffEnums.SalaryRegion;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** DTO thao tác trên hồ sơ: lương, ngân hàng, điều chuyển, nghỉ việc, lịch sử. */
public final class StaffActionDtos {

	private StaffActionDtos() {
	}

	/** Khóa phụ cấp được phép (đồng/tháng); `seniorityPercent` là % thâm niên. */
	public static final List<String> ALLOWANCE_KEYS = List.of("lunch", "transport", "phone", "responsibility",
			"position", "seniorityPercent", "other");

	public record SalaryConfigRequest(@NotNull LocalDate effectiveFrom, @NotNull SalaryMode salaryMode,
			@PositiveOrZero BigDecimal baseSalary, @DecimalMin(value = "0.001") BigDecimal coefficient,
			SalaryRegion region,
			@Schema(description = "Phụ cấp theo khóa: lunch, transport, phone, responsibility, position, seniorityPercent, other")
			Map<String, @PositiveOrZero Long> allowances,
			@PositiveOrZero BigDecimal insuranceSalary, @Size(max = 500) String note) {
	}

	public record SalaryConfigDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate effectiveFrom,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SalaryMode salaryMode,
			BigDecimal baseSalary, BigDecimal coefficient, SalaryRegion region,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<String, Long> allowances,
			BigDecimal insuranceSalary, String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			String createdByName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Bản đang áp dụng hôm nay") boolean current) {
	}

	public record BankRequest(@Size(max = 100) String bankName, @Size(max = 30) String bankAccountNo,
			@Size(max = 200) String bankAccountHolder) {
	}

	public record TransferRequest(@NotNull UUID schoolId,
			@Schema(description = "Ngày hiệu lực; tương lai thì hệ thống tự chuyển khi tới ngày") @NotNull LocalDate effectiveDate,
			UUID decisionFileId, @Size(max = 500) String note) {
	}

	public record TerminateRequest(@NotNull LocalDate endDate, @NotBlank @Size(max = 500) String reason,
			UUID decisionFileId) {
	}

	public record AssignmentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromDate,
			LocalDate toDate, FileRef decisionFile, String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Điều chuyển có hiệu lực trong tương lai, chưa áp dụng") boolean pending) {
	}

	/** Một mục nhật ký chỉnh sửa (dữ liệu trước/sau dạng JSON). */
	public record HistoryEvent(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant at,
			String userName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "staff, staff.contract, staff.document, staff.salary, staff.transfer…") String entity,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) AuditLog.Action action,
			Map<String, Object> before, Map<String, Object> after) {
	}

	public record StaffHistory(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AssignmentDto> assignments,
			@Schema(description = "Rỗng nếu người xem không được xem lương") List<SalaryConfigDto> salaryConfigs,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<HistoryEvent> events) {
	}

}
