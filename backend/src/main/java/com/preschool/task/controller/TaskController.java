package com.preschool.task.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.web.PageResponse;
import com.preschool.task.dto.TaskDtos.AssigneeDoneRequest;
import com.preschool.task.dto.TaskDtos.AttachmentDto;
import com.preschool.task.dto.TaskDtos.AttachmentRequest;
import com.preschool.task.dto.TaskDtos.ChecklistItemDto;
import com.preschool.task.dto.TaskDtos.ChecklistItemRequest;
import com.preschool.task.dto.TaskDtos.ChecklistToggleRequest;
import com.preschool.task.dto.TaskDtos.CommentDto;
import com.preschool.task.dto.TaskDtos.CommentRequest;
import com.preschool.task.dto.TaskDtos.CreateTaskRequest;
import com.preschool.task.dto.TaskDtos.StatusRequest;
import com.preschool.task.dto.TaskDtos.TaskDetail;
import com.preschool.task.dto.TaskDtos.TaskItem;
import com.preschool.task.dto.TaskDtos.TaskQuery;
import com.preschool.task.dto.TaskDtos.UpdateTaskRequest;
import com.preschool.task.service.TaskService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Công việc: giao việc, theo dõi tiến độ, checklist, bình luận, đính kèm và việc của tôi. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Công việc")
public class TaskController {

	private final TaskService tasks;

	public TaskController(TaskService tasks) {
		this.tasks = tasks;
	}

	@GetMapping("/tasks")
	@Operation(summary = "Danh sách việc trong phạm vi (nhân viên chỉ thấy việc của mình)")
	public PageResponse<TaskItem> list(@ParameterObject TaskQuery query, @ParameterObject Pageable pageable) {
		return tasks.list(query, pageable);
	}

	@PostMapping("/tasks")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Giao việc (báo cho người nhận)")
	public TaskItem create(@Valid @RequestBody CreateTaskRequest request) {
		return tasks.create(request);
	}

	@GetMapping("/tasks/{id}")
	@Operation(summary = "Chi tiết việc: checklist, bình luận, đính kèm, lịch sử trạng thái")
	public TaskDetail detail(@PathVariable UUID id) {
		return tasks.detail(id);
	}

	@PutMapping("/tasks/{id}")
	@Operation(summary = "Sửa việc và danh sách người nhận (người giao hoặc quản lý cơ sở)")
	public TaskItem update(@PathVariable UUID id, @Valid @RequestBody UpdateTaskRequest request) {
		return tasks.update(id, request);
	}

	@PatchMapping("/tasks/{id}/status")
	@Operation(summary = "Đổi trạng thái; người nhận chỉ tới Chờ duyệt, người giao mới Hoàn thành hoặc Hủy")
	public TaskItem changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
		return tasks.changeStatus(id, request.status());
	}

	@PutMapping("/tasks/{id}/assignees/me")
	@Operation(summary = "Đánh dấu phần việc của tôi đã xong")
	public TaskItem markMyPart(@PathVariable UUID id, @Valid @RequestBody AssigneeDoneRequest request) {
		return tasks.markMyPart(id, request.done());
	}

	@PostMapping("/tasks/{id}/checklist")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm mục checklist")
	public ChecklistItemDto addChecklistItem(@PathVariable UUID id, @Valid @RequestBody ChecklistItemRequest request) {
		return tasks.addChecklistItem(id, request.content());
	}

	@PutMapping("/tasks/{id}/checklist/{itemId}")
	@Operation(summary = "Tick hoặc bỏ tick một mục checklist (người nhận việc làm được)")
	public ChecklistItemDto toggleChecklistItem(@PathVariable UUID id, @PathVariable UUID itemId,
			@Valid @RequestBody ChecklistToggleRequest request) {
		return tasks.toggleChecklistItem(id, itemId, request.done());
	}

	@DeleteMapping("/tasks/{id}/checklist/{itemId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa mục checklist")
	public void deleteChecklistItem(@PathVariable UUID id, @PathVariable UUID itemId) {
		tasks.deleteChecklistItem(id, itemId);
	}

	@PostMapping("/tasks/{id}/comments")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Bình luận (kèm tệp nếu có)")
	public CommentDto comment(@PathVariable UUID id, @Valid @RequestBody CommentRequest request) {
		return tasks.comment(id, request.body(), request.fileId());
	}

	@PostMapping("/tasks/{id}/attachments")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Đính kèm tệp đã tải lên")
	public AttachmentDto attach(@PathVariable UUID id, @Valid @RequestBody AttachmentRequest request) {
		return tasks.attach(id, request.fileId());
	}

	@DeleteMapping("/tasks/{id}/attachments/{attachmentId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Bỏ tệp đính kèm")
	public void detach(@PathVariable UUID id, @PathVariable UUID attachmentId) {
		tasks.detach(id, attachmentId);
	}

	@GetMapping("/tasks/{id}/files/{fileId}/download-url")
	@Operation(summary = "Link có hạn để xem hoặc tải tệp của việc")
	public DownloadUrlResponse fileUrl(@PathVariable UUID id, @PathVariable UUID fileId,
			@RequestParam(defaultValue = "false") boolean inline) {
		return tasks.fileUrl(id, fileId, inline);
	}

	@GetMapping("/me/tasks")
	@Operation(summary = "Việc được giao cho tôi, hạn gần nhất trước")
	public List<TaskItem> myTasks(@RequestParam(defaultValue = "false") boolean includeDone) {
		return tasks.myTasks(includeDone);
	}

}
