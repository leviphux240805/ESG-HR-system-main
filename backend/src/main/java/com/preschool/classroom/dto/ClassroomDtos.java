package com.preschool.classroom.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.TeacherRole;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Năm học, khối, lớp và phân công giáo viên. */
public final class ClassroomDtos {

	private ClassroomDtos() {
	}

	public record SchoolYearDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "2026-2027") String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate startDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate endDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean current) {
	}

	public record SchoolYearRequest(
			@NotBlank(message = "Vui lòng nhập tên năm học.") @Size(max = 20, message = "Tên năm học tối đa 20 ký tự.") String name,
			@NotNull(message = "Vui lòng chọn ngày bắt đầu.") LocalDate startDate,
			@NotNull(message = "Vui lòng chọn ngày kết thúc.") LocalDate endDate) {
	}

	public record AgeGroupDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int minMonths,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int maxMonths,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int maxClassSize) {
	}

	public record AgeGroupRequest(
			@NotBlank(message = "Vui lòng nhập tên khối.") @Size(max = 100) String name,
			@Min(value = 0, message = "Tháng tuổi không hợp lệ.") int minMonths,
			@Max(value = 120, message = "Tháng tuổi không hợp lệ.") int maxMonths,
			@Min(value = 1, message = "Sĩ số tối đa phải lớn hơn 0.") @Max(value = 100, message = "Sĩ số tối đa không quá 100.") int maxClassSize) {
	}

	public record TeacherDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Id dòng phân công") UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) TeacherRole role,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromDate,
			LocalDate toDate) {
	}

	public record ClassItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolYearId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			String room,
			String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID ageGroupId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String ageGroupCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String ageGroupName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int capacity,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Sĩ số tối đa theo khối") int maxClassSize,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số trẻ đang học") int size,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int boys,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int girls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TeacherDto> teachers,
			@Schema(description = "Số trẻ có mặt hôm nay; rỗng = chưa điểm danh") Integer presentToday,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManage) {
	}

	public record ClassDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ClassItem item,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Lịch sử phân công, mới nhất trước") List<TeacherDto> teacherHistory) {
	}

	public record ClassRequest(
			@Schema(description = "Năm học; chỉ dùng khi tạo, rỗng = năm học hiện hành") UUID schoolYearId,
			@NotNull(message = "Vui lòng chọn khối.") UUID ageGroupId,
			@NotBlank(message = "Vui lòng nhập tên lớp.") @Size(max = 100, message = "Tên lớp tối đa 100 ký tự.") String name,
			@Size(max = 50) String room,
			@Schema(description = "Rỗng = sĩ số tối đa của khối") @Min(value = 1, message = "Sĩ số phải lớn hơn 0.") @Max(value = 100, message = "Sĩ số không quá 100.") Integer capacity,
			@Size(max = 500) String note) {
	}

	public record AssignTeacherRequest(
			@NotNull(message = "Vui lòng chọn giáo viên.") UUID staffId,
			@NotNull(message = "Vui lòng chọn vai trò.") TeacherRole role,
			@Schema(description = "Rỗng = hôm nay") LocalDate fromDate) {
	}

	public record EndAssignmentRequest(@Schema(description = "Rỗng = hôm nay") LocalDate toDate) {
	}

}
