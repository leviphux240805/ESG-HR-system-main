package com.preschool.task.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.staff.dto.StaffRecordDtos.FileRef;
import com.preschool.task.entity.Task.Priority;
import com.preschool.task.entity.Task.Status;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Công việc: danh sách, chi tiết, tạo/sửa, trạng thái, checklist, bình luận, đính kèm, lặp lại. */
public final class TaskDtos {

	private TaskDtos() {
	}

	public record AssigneeDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean done) {
	}

	/** Lặp lại: DAILY (mọi ngày), WEEKLY (các thứ trong tuần, 1 = thứ Hai), MONTHLY (ngày trong tháng). */
	public record RecurrenceDto(
			@NotNull @Pattern(regexp = "^(DAILY|WEEKLY|MONTHLY)$") String freq,
			@Schema(description = "WEEKLY: 1 = thứ Hai … 7 = Chủ nhật") List<@Min(1) @Max(7) Integer> byDay,
			@Schema(description = "MONTHLY: ngày trong tháng (tháng ngắn hơn thì ngày cuối tháng)") @Min(1) @Max(31) Integer byMonthDay,
			@Schema(description = "Ngày kết thúc lặp (bỏ trống = không kết thúc)") LocalDate until) {
	}

	/** Bộ lọc của danh sách việc (tham số query). */
	public record TaskQuery(
			@Schema(description = "Lọc theo cơ sở; bỏ trống = mọi cơ sở trong phạm vi, gồm cả việc cả tổ chức") UUID schoolId,
			Status status,
			Priority priority,
			@Schema(description = "Chỉ việc giao cho nhân viên này") UUID assigneeStaffId,
			@Schema(description = "Hạn từ thời điểm này") Instant dueFrom,
			@Schema(description = "Hạn trước thời điểm này") Instant dueTo,
			@Schema(description = "Chỉ việc quá hạn mà chưa xong") Boolean overdue,
			@Schema(description = "Tìm theo tên việc") String q) {
	}

	public record TaskItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = việc cả tổ chức") UUID schoolId,
			String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Priority priority,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Status status,
			Instant dueAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Quá hạn mà chưa xong") boolean overdue,
			Instant completedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AssigneeDto> assignees,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int checklistDone,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int checklistTotal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Là mẫu việc lặp lại") boolean template,
			@Schema(description = "Bản việc sinh từ mẫu lặp lại") UUID parentId,
			LocalDate occurrenceDate,
			String createdByName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canEdit,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Trạng thái người xem được chuyển sang") List<Status> allowedStatuses) {
	}

	public record ChecklistItemDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String content,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean done) {
	}

	public record CommentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String userName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String body,
			FileRef file,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
	}

	public record AttachmentDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) FileRef file) {
	}

	/** Một lần đổi trạng thái/sửa (từ nhật ký). */
	public record HistoryItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant at,
			String userName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String description) {
	}

	public record TaskDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) TaskItem task,
			String description,
			RecurrenceDto recurrence,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ChecklistItemDto> checklist,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CommentDto> comments,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AttachmentDto> attachments,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<HistoryItem> history,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Người xem là người nhận việc") boolean assignee) {
	}

	public record CreateTaskRequest(
			@Schema(description = "Bỏ trống = việc cả tổ chức (hiệu trưởng)") UUID schoolId,
			@NotBlank @Size(max = 300) String title,
			@Size(max = 5000) String description,
			@NotNull Priority priority,
			Instant dueAt,
			@NotNull @Size(min = 1, max = 50) List<@NotNull UUID> assigneeStaffIds,
			@Size(max = 50) List<@NotBlank @Size(max = 500) String> checklist,
			@Size(max = 20) List<@NotNull UUID> attachmentFileIds,
			@Valid RecurrenceDto recurrence) {
	}

	public record UpdateTaskRequest(
			@NotBlank @Size(max = 300) String title,
			@Size(max = 5000) String description,
			@NotNull Priority priority,
			Instant dueAt,
			@NotNull @Size(min = 1, max = 50) List<@NotNull UUID> assigneeStaffIds) {
	}

	public record StatusRequest(@NotNull Status status) {
	}

	public record ChecklistItemRequest(@NotBlank @Size(max = 500) String content) {
	}

	public record ChecklistToggleRequest(@NotNull Boolean done) {
	}

	public record CommentRequest(@NotBlank @Size(max = 2000) String body, UUID fileId) {
	}

	public record AttachmentRequest(@NotNull UUID fileId) {
	}

	public record AssigneeDoneRequest(@NotNull Boolean done) {
	}

}
