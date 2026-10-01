package com.preschool.today.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.staff.entity.StaffEnums.Position;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Trang Hôm nay, phân công dạy thay và Hộp duyệt. */
public final class TodayDtos {

	private TodayDtos() {
	}

	public record TodaySummary(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate date,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Có trường đang chọn học hôm nay") boolean schoolDay,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TodayClass> classes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AbsentChild> absentChildren,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<StaffLeave> staffOnLeave,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Nhân viên đang làm, không nghỉ hôm nay") List<StaffOption> availableStaff,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pendingLeaves,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pendingTasks,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int tasksDueToday,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int tasksOverdue,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Được phân công dạy thay") boolean canAssignSubstitute) {
	}

	public record TodayClass(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String ageGroupName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int size,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int present,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int excused,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int absent,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Đã điểm danh hôm nay") boolean taken,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TodayTeacher> teachers,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Có giáo viên nghỉ chưa có người thay") boolean shortStaffed) {
	}

	public record TodayTeacher(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean onLeave,
			UUID substituteStaffId, String substituteName) {
	}

	public record AbsentChild(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID childId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID classId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String className,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) AttendanceStatus status,
			String note) {
	}

	public record StaffLeave(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Position position,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Mã công: P, 1/2P, K, O…") String attendanceCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Lớp đang phụ trách") List<LeaveClass> classes) {
	}

	public record LeaveClass(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID classId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String className,
			UUID substituteStaffId, String substituteName) {
	}

	public record StaffOption(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Position position,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId) {
	}

	public record SubstitutionRequest(
			@NotNull(message = "Vui lòng chọn lớp.") UUID classId,
			@NotNull(message = "Vui lòng chọn giáo viên nghỉ.") UUID absentStaffId,
			@NotNull(message = "Vui lòng chọn người dạy thay.") UUID staffId,
			@Schema(description = "Bỏ trống = hôm nay") LocalDate date) {
	}

	// ------------------------------------------------------------ hộp duyệt

	public enum ApprovalType {
		LEAVE, TASK
	}

	public record ApprovalItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ApprovalType type,
			UUID schoolId, String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Người xin nghỉ hoặc người nhận việc") String requester,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			@Schema(description = "Có khi type = LEAVE") LeaveInfo leave,
			@Schema(description = "Có khi type = TASK") TaskInfo task) {
	}

	public record LeaveInfo(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String leaveCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String attendanceCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate fromDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate toDate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal days,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reason) {
	}

	public record TaskInfo(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			Instant dueAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int checklistDone,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int checklistTotal) {
	}

	public record DecisionRequest(@Size(max = 500) String note) {
	}

}
