package com.preschool.today.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.preschool.attendance.dto.LeaveDtos.LeaveRequestDto;
import com.preschool.attendance.entity.LeaveRequest;
import com.preschool.attendance.service.LeaveService;
import com.preschool.common.error.ApiException;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.task.dto.TaskDtos.AssigneeDto;
import com.preschool.task.dto.TaskDtos.TaskItem;
import com.preschool.task.dto.TaskDtos.TaskQuery;
import com.preschool.task.entity.Task.Status;
import com.preschool.task.service.TaskService;
import com.preschool.today.dto.TodayDtos.ApprovalItem;
import com.preschool.today.dto.TodayDtos.ApprovalType;
import com.preschool.today.dto.TodayDtos.LeaveInfo;
import com.preschool.today.dto.TodayDtos.TaskInfo;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hộp duyệt: gộp đơn nghỉ chờ duyệt mà người xem có quyền duyệt và việc chờ duyệt người xem quản lý, trong các trường
 * đang chọn. Duyệt/từ chối đi qua service của từng module nên giữ nguyên kiểm tra quyền, khóa tháng, thông báo.
 */
@Service
public class ApprovalService {

	/** Đủ lớn cho một hộp duyệt; danh sách không phân trang. */
	private static final Pageable ALL = PageRequest.of(0, 500);

	private final LeaveService leaves;

	private final TaskService tasks;

	private final SchoolRepository schools;

	public ApprovalService(LeaveService leaves, TaskService tasks, SchoolRepository schools) {
		this.leaves = leaves;
		this.tasks = tasks;
		this.schools = schools;
	}

	@Transactional(readOnly = true)
	public List<ApprovalItem> items() {
		UUID me = SchoolScope.require().access().staffId();
		Map<UUID, String> names = schools.findAllByIdInOrderByCode(SchoolScope.require().effectiveSchoolIds())
			.stream()
			.collect(Collectors.toMap(School::getId, School::getName));
		List<ApprovalItem> items = new ArrayList<>();
		for (LeaveRequestDto l : pendingLeaves()) {
			if (!l.staffId().equals(me)) {
				items.add(new ApprovalItem(l.id(), ApprovalType.LEAVE, l.schoolId(), names.get(l.schoolId()),
						l.staffName(), l.createdAt(), new LeaveInfo(l.leaveCode(), l.attendanceCode(), l.fromDate(),
								l.toDate(), l.days(), l.reason()), null));
			}
		}
		for (TaskItem t : pendingTasks()) {
			items.add(new ApprovalItem(t.id(), ApprovalType.TASK, t.schoolId(), t.schoolName(),
					t.assignees().stream().map(AssigneeDto::fullName).collect(Collectors.joining(", ")), t.createdAt(),
					null, new TaskInfo(t.title(), t.dueAt(), t.checklistDone(), t.checklistTotal())));
		}
		items.sort(Comparator.comparing(ApprovalItem::createdAt).reversed());
		return items;
	}

	/** Số mục chờ duyệt theo loại (trang Hôm nay). */
	@Transactional(readOnly = true)
	public Map<ApprovalType, Long> counts() {
		return items().stream().collect(Collectors.groupingBy(ApprovalItem::type, Collectors.counting()));
	}

	@Transactional
	public void approve(ApprovalType type, UUID id, String note) {
		switch (type) {
			case LEAVE -> leaves.approve(id, note);
			case TASK -> {
				requirePendingTask(id);
				tasks.changeStatus(id, Status.DONE);
				if (note != null && !note.isBlank()) {
					tasks.comment(id, note.trim(), null);
				}
			}
		}
	}

	/** Từ chối: đơn nghỉ bị từ chối; việc quay lại "Đang làm" kèm bình luận lý do. */
	@Transactional
	public void reject(ApprovalType type, UUID id, String note) {
		if (note == null || note.isBlank()) {
			throw ApiException.badRequest("NOTE_REQUIRED", "Vui lòng nhập lý do từ chối.")
				.withFieldErrors(List.of(Map.of("field", "note", "message", "Vui lòng nhập lý do từ chối")));
		}
		switch (type) {
			case LEAVE -> leaves.reject(id, note);
			case TASK -> {
				requirePendingTask(id);
				tasks.changeStatus(id, Status.IN_PROGRESS);
				tasks.comment(id, "Chưa duyệt: " + note.trim(), null);
			}
		}
	}

	private List<LeaveRequestDto> pendingLeaves() {
		return leaves.list(LeaveRequest.Status.PENDING, ALL).items().stream().filter(LeaveRequestDto::canReview).toList();
	}

	private List<TaskItem> pendingTasks() {
		return tasks.list(new TaskQuery(null, Status.WAITING_APPROVAL, null, null, null, null, null, null), ALL)
			.items()
			.stream()
			.filter(t -> t.canEdit() && t.allowedStatuses().contains(Status.DONE))
			.toList();
	}

	private void requirePendingTask(UUID id) {
		if (pendingTasks().stream().noneMatch(t -> t.id().equals(id))) {
			throw ApiException.notFound("Không tìm thấy việc chờ duyệt.");
		}
	}

}
