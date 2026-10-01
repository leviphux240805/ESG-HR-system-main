package com.preschool.health.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.health.entity.HealthEnums.Meal;
import com.preschool.health.entity.HealthEnums.MenuStatus;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Món ăn, thực đơn tuần, cảnh báo dị ứng. */
public final class MenuDtos {

	private MenuDtos() {
	}

	public record Ingredient(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank(message = "Vui lòng nhập tên nguyên liệu.") @Size(max = 100, message = "Tên nguyên liệu tối đa 100 ký tự.") String name,
			@DecimalMin(value = "0", message = "Khối lượng không hợp lệ.") @DecimalMax(value = "5000", message = "Khối lượng không hợp lệ.") BigDecimal grams) {
	}

	public record DishDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Món dùng chung trong tổ chức") boolean shared,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Ingredient> ingredients,
			BigDecimal kcal,
			BigDecimal proteinG,
			BigDecimal fatG,
			BigDecimal carbG,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean active,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit) {
	}

	public record DishRequest(
			@NotBlank(message = "Vui lòng nhập tên món.") @Size(max = 150, message = "Tên món tối đa 150 ký tự.") String name,
			@NotNull(message = "Danh sách nguyên liệu không hợp lệ.") @Size(max = 30, message = "Tối đa 30 nguyên liệu.") List<@Valid Ingredient> ingredients,
			@DecimalMin(value = "0", message = "Năng lượng không hợp lệ.") @DecimalMax(value = "5000", message = "Năng lượng không hợp lệ.") BigDecimal kcal,
			@DecimalMin(value = "0", message = "Chất đạm không hợp lệ.") @DecimalMax(value = "500", message = "Chất đạm không hợp lệ.") BigDecimal proteinG,
			@DecimalMin(value = "0", message = "Chất béo không hợp lệ.") @DecimalMax(value = "500", message = "Chất béo không hợp lệ.") BigDecimal fatG,
			@DecimalMin(value = "0", message = "Chất bột đường không hợp lệ.") @DecimalMax(value = "500", message = "Chất bột đường không hợp lệ.") BigDecimal carbG,
			@Schema(description = "Món dùng chung trong tổ chức (chỉ hiệu trưởng); bỏ qua khi sửa") Boolean shared,
			@Schema(description = "Mặc định đang dùng") Boolean active) {
	}

	public record MenuItemDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Meal meal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID dishId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String dishName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int orderNo,
			String note,
			BigDecimal kcal) {
	}

	public record DayNutrition(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal kcal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal proteinG,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal fatG,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal carbG) {
	}

	public record MenuWeekDto(
			@Schema(description = "Rỗng khi tuần này chưa có thực đơn") UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			UUID ageGroupId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate weekStart,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) MenuStatus status,
			String note,
			Instant publishedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MenuItemDto> items,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DayNutrition> days,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số trẻ có ghi chú dị ứng bị trùng nguyên liệu trong tuần") int allergyAlerts,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit) {
	}

	public record MenuItemRequest(
			@NotNull(message = "Vui lòng chọn ngày.") LocalDate date,
			@NotNull(message = "Vui lòng chọn bữa.") Meal meal,
			@NotNull(message = "Vui lòng chọn món.") UUID dishId,
			@Size(max = 300, message = "Ghi chú tối đa 300 ký tự.") String note) {
	}

	public record SaveMenuRequest(
			@NotNull(message = "Vui lòng chọn tuần.") LocalDate weekStart,
			UUID ageGroupId,
			@Size(max = 500, message = "Ghi chú tối đa 500 ký tự.") String note,
			@NotNull @Size(max = 200, message = "Tối đa 200 món mỗi tuần.") List<@Valid MenuItemRequest> items) {
	}

	public record CopyMenuRequest(
			@NotNull(message = "Vui lòng chọn tuần nguồn.") LocalDate fromWeekStart,
			@NotNull(message = "Vui lòng chọn tuần đích.") LocalDate toWeekStart,
			UUID ageGroupId,
			@Schema(description = "Ghi đè khi tuần đích đã có món") Boolean overwrite) {
	}

	public record AllergyMatch(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Meal meal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String dishName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Nguyên liệu (hoặc tên món) trùng ghi chú dị ứng") String ingredient) {
	}

	public record AllergyWarning(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String childName,
			String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String allergyNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AllergyMatch> matches) {
	}

}
