package com.preschool.health.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.health.entity.HealthEnums.BmiStatus;
import com.preschool.health.entity.HealthEnums.GrowthStandard;
import com.preschool.health.entity.HealthEnums.HealthLogType;
import com.preschool.health.entity.HealthEnums.HeightStatus;
import com.preschool.health.entity.HealthEnums.MeasurementSource;
import com.preschool.health.entity.HealthEnums.WeightStatus;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cân đo, biểu đồ tăng trưởng, sổ theo dõi sức khỏe, khám định kỳ. */
public final class HealthDtos {

	private HealthDtos() {
	}

	public record MeasurementDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate measuredOn,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal weightKg,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal heightCm,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal ageMonths,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal bmi,
			BigDecimal weightZ,
			BigDecimal heightZ,
			BigDecimal bmiZ,
			WeightStatus weightStatus,
			HeightStatus heightStatus,
			BmiStatus bmiStatus,
			@Schema(description = "Rỗng khi tuổi ngoài phạm vi bảng chuẩn") GrowthStandard standard,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) MeasurementSource source,
			String note,
			String recordedByName) {
	}

	public record MeasurementRow(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String childCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Gender gender,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate dob,
			@Schema(description = "Lần cân đo đúng ngày đang xem") MeasurementDto current,
			@Schema(description = "Lần cân đo gần nhất trước ngày đang xem") MeasurementDto previous) {
	}

	public record ClassMeasurementSheet(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID classId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MeasurementRow> rows) {
	}

	public record MeasurementInput(
			@NotNull(message = "Thiếu trẻ.") UUID childId,
			@NotNull(message = "Vui lòng nhập cân nặng.") @DecimalMin(value = "1", message = "Cân nặng phải từ 1 đến 99 kg.") @DecimalMax(value = "99", message = "Cân nặng phải từ 1 đến 99 kg.") BigDecimal weightKg,
			@NotNull(message = "Vui lòng nhập chiều cao.") @DecimalMin(value = "40", message = "Chiều cao phải từ 40 đến 199 cm.") @DecimalMax(value = "199", message = "Chiều cao phải từ 40 đến 199 cm.") BigDecimal heightCm,
			@Size(max = 300, message = "Ghi chú tối đa 300 ký tự.") String note) {
	}

	public record SaveMeasurementsRequest(
			@NotNull(message = "Vui lòng chọn ngày cân đo.") LocalDate date,
			@NotNull(message = "Vui lòng chọn nguồn số liệu.") MeasurementSource source,
			@NotNull @Size(min = 1, max = 100, message = "Cần từ 1 đến 100 trẻ.") List<@Valid MeasurementInput> rows) {
	}

	public record CurvePoint(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal ageMonths,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal sd3neg,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal sd2neg,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal median,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal sd2,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal sd3) {
	}

	public record GrowthChart(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Gender gender,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate dob,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MeasurementDto> measurements,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đường chuẩn cân nặng/tuổi theo tháng") List<CurvePoint> weightCurve,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CurvePoint> heightCurve,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CurvePoint> bmiCurve,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit) {
	}

	public record HealthLogDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String childName,
			UUID classId,
			String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate logDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) HealthLogType type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String content,
			BigDecimal temperatureC,
			Instant parentNotifiedAt,
			String parentNotifiedByName,
			String recordedByName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit) {
	}

	public record HealthLogRequest(
			@NotNull(message = "Vui lòng chọn trẻ.") UUID childId,
			@NotNull(message = "Vui lòng chọn ngày.") LocalDate logDate,
			@NotNull(message = "Vui lòng chọn loại.") HealthLogType type,
			@NotBlank(message = "Vui lòng nhập nội dung.") @Size(max = 2000, message = "Nội dung tối đa 2000 ký tự.") String content,
			@DecimalMin(value = "34", message = "Nhiệt độ phải từ 34 đến 43 °C.") @DecimalMax(value = "43", message = "Nhiệt độ phải từ 34 đến 43 °C.") BigDecimal temperatureC,
			@Schema(description = "Đã báo phụ huynh (ghi thời điểm và người báo); rỗng = giữ nguyên") Boolean parentNotified) {
	}

	public record CheckupDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate checkupDate,
			String provider,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String summary,
			UUID fileId) {
	}

	public record CheckupRequest(
			@NotNull(message = "Vui lòng chọn ngày khám.") LocalDate checkupDate,
			@Size(max = 200, message = "Nơi khám tối đa 200 ký tự.") String provider,
			@NotBlank(message = "Vui lòng nhập kết luận.") @Size(max = 2000, message = "Kết luận tối đa 2000 ký tự.") String summary,
			UUID fileId) {
	}

	public record ChildHealth(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) GrowthChart growth,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CheckupDto> checkups,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "20 ghi chép sổ theo dõi gần nhất") List<HealthLogDto> recentLogs,
			String allergyNote,
			String healthNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Ghi/xóa kết quả khám (y tế, hiệu trưởng)") boolean canEditCheckups) {
	}

}
