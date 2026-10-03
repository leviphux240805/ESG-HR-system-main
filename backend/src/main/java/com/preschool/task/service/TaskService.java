package com.preschool.task.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditLogRepository;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.web.PageResponse;
import com.preschool.notification.service.NotificationService;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;
import com.preschool.security.SchoolScope;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.repository.StaffRepository;
import com.preschool.task.dto.TaskDtos.AssigneeDto;
import com.preschool.task.dto.TaskDtos.AttachmentDto;
import com.preschool.task.dto.TaskDtos.ChecklistItemDto;
import com.preschool.task.dto.TaskDtos.CommentDto;
import com.preschool.task.dto.TaskDtos.CreateTaskRequest;
import com.preschool.task.dto.TaskDtos.HistoryItem;
import com.preschool.task.dto.TaskDtos.TaskDetail;
import com.preschool.task.dto.TaskDtos.TaskItem;
import com.preschool.task.dto.TaskDtos.TaskQuery;
import com.preschool.task.dto.TaskDtos.UpdateTaskRequest;
import com.preschool.task.entity.Task;
import com.preschool.task.entity.Task.Status;
import com.preschool.task.entity.TaskAssignee;
import com.preschool.task.entity.TaskAttachment;
import com.preschool.task.entity.TaskChecklistItem;
import com.preschool.task.entity.TaskComment;
import com.preschool.task.entity.TaskCommentFile;
import com.preschool.task.repository.TaskAssigneeRepository;
import com.preschool.task.repository.TaskAttachmentRepository;
import com.preschool.task.repository.TaskChecklistItemRepository;
import com.preschool.task.repository.TaskCommentFileRepository;
import com.preschool.task.repository.TaskCommentRepository;
import com.preschool.task.repository.TaskRepository;

import jakarta.persistence.criteria.Predicate;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Công việc: giao cho một hoặc nhiều nhân viên, checklist, bình luận, đính kèm.
 *
 * <p>Luồng trạng thái theo thiết kế: Mới, Đang làm, Chờ duyệt, Hoàn thành (hoặc Hủy). Người nhận chỉ đẩy được tới
 * "Chờ duyệt"; bước cuối (Hoàn thành, Hủy) do người giao hoặc quản lý cơ sở quyết định. Lịch sử trạng thái đọc từ
 * nhật ký thao tác ({@code audit_logs}).
 */
@Service
public class TaskService {

	static final String NOTIFY_TYPE = "TASK";

	static final String AUDIT_ENTITY = "task";

	/** Giới hạn mỗi file đính kèm công việc (nhỏ hơn giới hạn chung của kho file). */
	static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

	/** Trường được phép sắp xếp (tham số sort không chạm tới trường khác của entity). */
	private static final Set<String> SORTABLE = Set.of("dueAt", "priority", "status", "title", "createdAt");

	private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("dueAt").nullsLast(), Sort.Order.desc("createdAt"));

	private final TaskRepository tasks;

	private final TaskAssigneeRepository assignees;

	private final TaskChecklistItemRepository checklist;

	private final TaskCommentRepository comments;

	private final TaskCommentFileRepository commentFiles;

	private final TaskAttachmentRepository attachments;

	private final StaffRepository staffRepo;

	private final UserRepository users;

	private final SchoolRepository schools;

	private final FileService fileService;

	private final NotificationService notifications;

	private final AuditService audit;

	private final AuditLogRepository auditLogs;

	private final TaskAccess access;

	private final JsonMapper jsonMapper;

	private final Clock clock;

	public TaskService(TaskRepository tasks, TaskAssigneeRepository assignees, TaskChecklistItemRepository checklist,
			TaskCommentRepository comments, TaskCommentFileRepository commentFiles, TaskAttachmentRepository attachments,
			StaffRepository staffRepo,
			UserRepository users, SchoolRepository schools, FileService fileService, NotificationService notifications,
			AuditService audit, AuditLogRepository auditLogs, TaskAccess access, JsonMapper jsonMapper, Clock clock) {
		this.tasks = tasks;
		this.assignees = assignees;
		this.checklist = checklist;
		this.comments = comments;
		this.commentFiles = commentFiles;
		this.attachments = attachments;
		this.staffRepo = staffRepo;
		this.users = users;
		this.schools = schools;
		this.fileService = fileService;
		this.notifications = notifications;
		this.audit = audit;
		this.auditLogs = auditLogs;
		this.access = access;
		this.jsonMapper = jsonMapper;
		this.clock = clock;
	}

	// ------------------------------------------------------------ danh sách

	@Transactional(readOnly = true)
	public PageResponse<TaskItem> list(TaskQuery query, Pageable pageable) {
		Page<Task> page = tasks.findAll(specification(query), paging(pageable));
		return new PageResponse<>(toItems(page.getContent()), page.getNumber(), page.getSize(), page.getTotalElements(),
				page.getTotalPages());
	}

	/** Việc được giao cho tôi, hạn gần nhất trước (trang "Việc của tôi"). */
	@Transactional(readOnly = true)
	public List<TaskItem> myTasks(boolean includeDone) {
		UUID staffId = requireMyStaffId();
		List<UUID> taskIds = assignees.findByStaffId(staffId).stream().map(TaskAssignee::getTaskId).toList();
		if (taskIds.isEmpty()) {
			return List.of();
		}
		List<Task> list = tasks.findAllById(taskIds)
			.stream()
			.filter(t -> !t.isTemplate())
			.filter(t -> includeDone || (t.getStatus() != Status.DONE && t.getStatus() != Status.CANCELLED))
			.sorted(Comparator.comparing(Task::getDueAt, Comparator.nullsLast(Instant::compareTo))
				.thenComparing(Task::getCreatedAt))
			.toList();
		return toItems(list);
	}

	@Transactional(readOnly = true)
	public TaskDetail detail(UUID id) {
		Task task = findVisible(id);
		TaskItem item = toItems(List.of(task)).getFirst();
		List<ChecklistItemDto> items = checklist.findByTaskIdOrderByOrderNo(id)
			.stream()
			.map(c -> new ChecklistItemDto(c.getId(), c.getContent(), c.isDone()))
			.toList();
		List<TaskComment> rows = comments.findByTaskIdOrderByCreatedAt(id);
		Map<UUID, String> names = userNames(rows.stream().map(TaskComment::getUserId).toList());
		Map<UUID, List<FileRef>> filesByComment = commentFileRefs(rows.stream().map(TaskComment::getId).toList());
		List<CommentDto> commentDtos = rows.stream()
			.map(c -> new CommentDto(c.getId(), names.getOrDefault(c.getUserId(), ""), c.getBody(),
					filesByComment.getOrDefault(c.getId(), List.of()), c.getCreatedAt()))
			.toList();
		List<TaskAttachment> attachmentRows = attachments.findByTaskId(id);
		Map<UUID, StoredFile> files = fileService
			.findForModule(attachmentRows.stream().map(TaskAttachment::getFileId).toList());
		List<AttachmentDto> attachmentDtos = attachmentRows.stream()
			.filter(a -> files.containsKey(a.getFileId()))
			.map(a -> new AttachmentDto(a.getId(), ref(files.get(a.getFileId()))))
			.toList();
		return new TaskDetail(item, task.getDescription(), RecurrenceRules.parse(task.getRecurrenceRule()), items,
				commentDtos, attachmentDtos, history(id), isAssignee(id));
	}

	// ------------------------------------------------------------ tạo, sửa

	@Transactional
	public TaskItem create(CreateTaskRequest request) {
		UUID schoolId = request.schoolId();
		access.requireManage(schoolId);
		List<Staff> members = requireAssignableStaff(schoolId, request.assigneeStaffIds());
		Task task = new Task(schoolId, request.title().trim(), trimToNull(request.description()), request.priority(),
				request.dueAt());
		task.setRecurrenceRule(RecurrenceRules.format(request.recurrence()));
		tasks.saveAndFlush(task);
		for (Staff staff : members) {
			assignees.save(new TaskAssignee(schoolId, task.getId(), staff.getId()));
		}
		int order = 0;
		for (String content : request.checklist() == null ? List.<String>of() : request.checklist()) {
			checklist.save(new TaskChecklistItem(schoolId, task.getId(), content.trim(), order++));
		}
		for (UUID fileId : distinct(request.attachmentFileIds())) {
			attachments.save(new TaskAttachment(schoolId, task.getId(), requireTaskFile(fileId).getId()));
		}
		audit.record(AUDIT_ENTITY, task.getId(), Action.CREATE, null, snapshot(task));
		notifyAssigned(task, members);
		return toItems(List.of(task)).getFirst();
	}

	@Transactional
	public TaskItem update(UUID id, UpdateTaskRequest request) {
		Task task = findVisible(id);
		requireEdit(task);
		requireOpen(task);
		List<Staff> members = requireAssignableStaff(task.getSchoolId(), request.assigneeStaffIds());
		Map<String, Object> before = snapshot(task);
		task.update(request.title().trim(), trimToNull(request.description()), request.priority(), request.dueAt());

		Set<UUID> wanted = members.stream().map(Staff::getId).collect(Collectors.toCollection(LinkedHashSet::new));
		List<TaskAssignee> current = assignees.findByTaskId(id);
		assignees.deleteAll(current.stream().filter(a -> !wanted.contains(a.getStaffId())).toList());
		Set<UUID> existing = current.stream().map(TaskAssignee::getStaffId).collect(Collectors.toSet());
		List<Staff> added = members.stream().filter(s -> !existing.contains(s.getId())).toList();
		for (Staff staff : added) {
			assignees.save(new TaskAssignee(task.getSchoolId(), id, staff.getId()));
		}
		audit.record(AUDIT_ENTITY, id, Action.UPDATE, before, snapshot(task));
		notifyAssigned(task, added);
		return toItems(List.of(task)).getFirst();
	}

	/**
	 * Đổi trạng thái. Người nhận việc đẩy tới "Chờ duyệt"; chỉ người giao (hoặc quản lý cơ sở) chuyển sang
	 * "Hoàn thành" hay "Hủy", đúng thiết kế "người giao duyệt bước cuối".
	 */
	@Transactional
	public TaskItem changeStatus(UUID id, Status status) {
		Task task = findVisible(id);
		Status from = task.getStatus();
		if (from == status) {
			return toItems(List.of(task)).getFirst();
		}
		if (!allowedStatuses(task).contains(status)) {
			throw ApiException.forbidden("TASK_STATUS_FORBIDDEN",
					canEdit(task) ? "Không chuyển được sang trạng thái này."
							: "Chỉ người giao việc mới kết thúc được việc.");
		}
		task.changeStatus(status, Instant.now(clock));
		audit.record(AUDIT_ENTITY, id, Action.UPDATE, Map.of("status", from.name()), Map.of("status", status.name()));
		notifyStatus(task, from);
		return toItems(List.of(task)).getFirst();
	}

	/** Người nhận đánh dấu phần việc của mình đã xong (việc giao cho nhiều người). */
	@Transactional
	public TaskItem markMyPart(UUID id, boolean done) {
		Task task = findVisible(id);
		requireOpen(task);
		UUID staffId = requireMyStaffId();
		TaskAssignee mine = assignees.findByTaskId(id)
			.stream()
			.filter(a -> a.getStaffId().equals(staffId))
			.findFirst()
			.orElseThrow(() -> ApiException.forbidden("TASK_NOT_ASSIGNEE", "Việc này không giao cho bạn."));
		mine.markDone(done, Instant.now(clock));
		return toItems(List.of(task)).getFirst();
	}

	// ------------------------------------------------------------ checklist, bình luận, đính kèm

	@Transactional
	public ChecklistItemDto addChecklistItem(UUID id, String content) {
		Task task = findVisible(id);
		requireEdit(task);
		requireOpen(task);
		int order = checklist.findByTaskIdOrderByOrderNo(id).size();
		TaskChecklistItem item = checklist
			.saveAndFlush(new TaskChecklistItem(task.getSchoolId(), id, content.trim(), order));
		return new ChecklistItemDto(item.getId(), item.getContent(), item.isDone());
	}

	/** Tick hoặc bỏ tick một mục: người nhận việc cũng làm được, đó là cách báo tiến độ. */
	@Transactional
	public ChecklistItemDto toggleChecklistItem(UUID id, UUID itemId, boolean done) {
		Task task = findVisible(id);
		requireOpen(task);
		if (!canEdit(task) && !isAssignee(id)) {
			throw ApiException.forbidden("TASK_FORBIDDEN", "Việc này không giao cho bạn.");
		}
		TaskChecklistItem item = requireChecklistItem(id, itemId);
		item.setDone(done);
		return new ChecklistItemDto(item.getId(), item.getContent(), item.isDone());
	}

	@Transactional
	public void deleteChecklistItem(UUID id, UUID itemId) {
		Task task = findVisible(id);
		requireEdit(task);
		checklist.delete(requireChecklistItem(id, itemId));
	}

	@Transactional
	public CommentDto comment(UUID id, String body, List<UUID> fileIds) {
		Task task = findVisible(id);
		String text = body == null ? "" : body.trim();
		List<StoredFile> files = distinct(fileIds).stream().map(this::requireTaskFile).toList();
		if (text.isEmpty() && files.isEmpty()) {
			throw ApiException.badRequest("COMMENT_EMPTY", "Nhập nội dung hoặc đính kèm file.");
		}
		TaskComment saved = comments.saveAndFlush(new TaskComment(task.getSchoolId(), id, access.myUserId(), text, null));
		files.forEach(f -> commentFiles.save(new TaskCommentFile(task.getSchoolId(), saved.getId(), f.getId())));
		notifyOthers(task, "Bình luận mới trong việc: " + task.getTitle(),
				text.isEmpty() ? "Đã gửi %d file".formatted(files.size()) : text, "task-comment:" + saved.getId());
		return new CommentDto(saved.getId(), userNames(List.of(saved.getUserId())).getOrDefault(saved.getUserId(), ""),
				saved.getBody(), files.stream().map(TaskService::ref).toList(), saved.getCreatedAt());
	}

	@Transactional
	public AttachmentDto attach(UUID id, UUID fileId) {
		Task task = findVisible(id);
		requireOpen(task);
		StoredFile file = requireTaskFile(fileId);
		if (attachments.findByTaskId(id).stream().anyMatch(a -> a.getFileId().equals(file.getId()))) {
			throw ApiException.conflict("TASK_FILE_DUPLICATE", "Tệp này đã được đính kèm.");
		}
		TaskAttachment saved = attachments.saveAndFlush(new TaskAttachment(task.getSchoolId(), id, file.getId()));
		return new AttachmentDto(saved.getId(), ref(file));
	}

	@Transactional
	public void detach(UUID id, UUID attachmentId) {
		Task task = findVisible(id);
		requireEdit(task);
		TaskAttachment attachment = attachments.findByTaskId(id)
			.stream()
			.filter(a -> a.getId().equals(attachmentId))
			.findFirst()
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy tệp đính kèm."));
		attachments.delete(attachment);
	}

	/** Link có hạn để xem tệp của việc (tệp đính kèm hoặc tệp trong bình luận). */
	@Transactional(readOnly = true)
	public DownloadUrlResponse fileUrl(UUID id, UUID fileId, boolean inline) {
		findVisible(id);
		boolean belongs = attachments.findByTaskId(id).stream().anyMatch(a -> a.getFileId().equals(fileId))
				|| commentFiles
					.findByCommentIdIn(comments.findByTaskIdOrderByCreatedAt(id).stream().map(TaskComment::getId).toList())
					.stream()
					.anyMatch(f -> f.getFileId().equals(fileId));
		if (!belongs) {
			throw ApiException.notFound("Không tìm thấy tệp của việc này.");
		}
		StoredFile file = fileService.findForModule(List.of(fileId)).get(fileId);
		if (file == null) {
			throw ApiException.notFound("Không tìm thấy tệp.");
		}
		return fileService.presignDownload(file, inline);
	}

	// ------------------------------------------------------------ quyền, truy vấn

	private Task findVisible(UUID id) {
		Task task = tasks.findById(id).orElseThrow(TaskService::notFound);
		if (!canEdit(task) && !isAssignee(task.getId())) {
			throw notFound();
		}
		return task;
	}

	/** Sửa, xóa, kết thúc việc: quản lý cơ sở của việc hoặc chính người đã giao việc. */
	private boolean canEdit(Task task) {
		return access.canManage(task.getSchoolId()) || access.myUserId().equals(task.getCreatedBy());
	}

	private boolean isAssignee(UUID taskId) {
		UUID staffId = access.myStaffId();
		return staffId != null && assignees.findByTaskId(taskId).stream().anyMatch(a -> a.getStaffId().equals(staffId));
	}

	private void requireEdit(Task task) {
		if (!canEdit(task)) {
			throw ApiException.forbidden("TASK_FORBIDDEN", "Chỉ người giao việc mới sửa được việc này.");
		}
	}

	private static void requireOpen(Task task) {
		if (task.getStatus() == Status.DONE || task.getStatus() == Status.CANCELLED) {
			throw ApiException.conflict("TASK_CLOSED", "Việc đã kết thúc, không cập nhật được.");
		}
	}

	/**
	 * Trạng thái người xem được chuyển sang. Người giao: mọi trạng thái khác hiện tại. Người nhận: tối đa tới
	 * "Chờ duyệt", và không đụng được vào việc đã kết thúc.
	 * TODO(assumption): quản lý cơ sở (hiệu trưởng) cũng kết thúc được việc do người khác giao trong cơ sở mình.
	 */
	private List<Status> allowedStatuses(Task task) {
		if (canEdit(task)) {
			return Arrays.stream(Status.values()).filter(s -> s != task.getStatus()).toList();
		}
		if (task.getStatus() == Status.DONE || task.getStatus() == Status.CANCELLED || !isAssignee(task.getId())) {
			return List.of();
		}
		return Stream.of(Status.NEW, Status.IN_PROGRESS, Status.WAITING_APPROVAL)
			.filter(s -> s != task.getStatus())
			.toList();
	}

	private Specification<Task> specification(TaskQuery q) {
		UUID myUserId = access.myUserId();
		UUID myStaffId = access.myStaffId();
		boolean principal = access.isPrincipal();
		Set<UUID> managed = SchoolScope.require()
			.effectiveSchoolIds()
			.stream()
			.filter(access::canManage)
			.collect(Collectors.toSet());
		Set<UUID> myTaskIds = myStaffId == null ? Set.of()
				: assignees.findByStaffId(myStaffId).stream().map(TaskAssignee::getTaskId).collect(Collectors.toSet());

		return (root, criteria, cb) -> {
			List<Predicate> and = new ArrayList<>();
			// Mẫu việc lặp lại không hiện trên bảng việc; chỉ các bản việc sinh ra mới hiện
			and.add(cb.isNull(root.get("recurrenceRule")));
			if (q.schoolId() != null) {
				and.add(cb.equal(root.get("schoolId"), q.schoolId()));
			}
			if (q.status() != null) {
				and.add(cb.equal(root.get("status"), q.status()));
			}
			if (q.priority() != null) {
				and.add(cb.equal(root.get("priority"), q.priority()));
			}
			if (q.dueFrom() != null) {
				and.add(cb.greaterThanOrEqualTo(root.get("dueAt"), q.dueFrom()));
			}
			if (q.dueTo() != null) {
				and.add(cb.lessThan(root.get("dueAt"), q.dueTo()));
			}
			if (Boolean.TRUE.equals(q.overdue())) {
				and.add(cb.lessThan(root.get("dueAt"), Instant.now(clock)));
				and.add(root.get("status").in(Status.NEW, Status.IN_PROGRESS, Status.WAITING_APPROVAL));
			}
			if (q.q() != null && !q.q().isBlank()) {
				and.add(cb.like(cb.lower(root.get("title")), "%" + q.q().trim().toLowerCase() + "%"));
			}
			if (q.assigneeStaffId() != null) {
				Set<UUID> ids = assignees.findByStaffId(q.assigneeStaffId())
					.stream()
					.map(TaskAssignee::getTaskId)
					.collect(Collectors.toSet());
				and.add(ids.isEmpty() ? cb.disjunction() : root.get("id").in(ids));
			}
			List<Predicate> visible = new ArrayList<>();
			visible.add(cb.equal(root.get("createdBy"), myUserId));
			if (!managed.isEmpty()) {
				visible.add(root.get("schoolId").in(managed));
			}
			if (principal) {
				visible.add(cb.isNull(root.get("schoolId")));
			}
			if (!myTaskIds.isEmpty()) {
				visible.add(root.get("id").in(myTaskIds));
			}
			and.add(cb.or(visible.toArray(Predicate[]::new)));
			return cb.and(and.toArray(Predicate[]::new));
		};
	}

	private static Pageable paging(Pageable pageable) {
		Sort sort = Sort
			.by(pageable.getSort().stream().filter(order -> SORTABLE.contains(order.getProperty())).toList());
		return PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100),
				sort.isSorted() ? sort : DEFAULT_SORT);
	}

	// ------------------------------------------------------------ hỗ trợ

	/** Người nhận phải đang làm việc và thuộc cơ sở của việc (việc cả tổ chức: cơ sở nào trong phạm vi cũng được). */
	private List<Staff> requireAssignableStaff(UUID schoolId, List<UUID> staffIds) {
		List<UUID> ids = distinct(staffIds);
		if (ids.isEmpty()) {
			throw fieldError("assigneeStaffIds", "Chọn ít nhất một người nhận việc");
		}
		Map<UUID, Staff> found = staffRepo.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(Staff::getId, Function.identity()));
		List<Staff> result = new ArrayList<>();
		for (UUID id : ids) {
			Staff staff = found.get(id);
			if (staff == null || !staff.isActive()) {
				throw fieldError("assigneeStaffIds", "Nhân viên không tồn tại hoặc đã nghỉ việc");
			}
			if (schoolId != null && !schoolId.equals(staff.getSchoolId())) {
				throw fieldError("assigneeStaffIds", "Nhân viên không thuộc cơ sở của việc");
			}
			if (schoolId == null && !SchoolScope.require().access().canAccess(staff.getSchoolId())) {
				throw fieldError("assigneeStaffIds", "Nhân viên không thuộc phạm vi của bạn");
			}
			result.add(staff);
		}
		return result;
	}

	private TaskChecklistItem requireChecklistItem(UUID taskId, UUID itemId) {
		return checklist.findByTaskIdOrderByOrderNo(taskId)
			.stream()
			.filter(c -> c.getId().equals(itemId))
			.findFirst()
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy mục checklist."));
	}

	private List<TaskItem> toItems(List<Task> list) {
		if (list.isEmpty()) {
			return List.of();
		}
		List<UUID> ids = list.stream().map(Task::getId).toList();
		Map<UUID, List<TaskAssignee>> byTask = assignees.findByTaskIdIn(ids)
			.stream()
			.collect(Collectors.groupingBy(TaskAssignee::getTaskId));
		Map<UUID, String> staffNames = staffRepo
			.findAllById(byTask.values().stream().flatMap(List::stream).map(TaskAssignee::getStaffId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Staff::getId, Staff::getFullName));
		Map<UUID, List<TaskChecklistItem>> checklistByTask = checklist.findByTaskIdIn(ids)
			.stream()
			.collect(Collectors.groupingBy(TaskChecklistItem::getTaskId));
		Map<UUID, String> schoolNames = schools.findAll()
			.stream()
			.collect(Collectors.toMap(School::getId, School::getName));
		Map<UUID, String> creators = userNames(list.stream().map(Task::getCreatedBy).toList());
		Instant now = Instant.now(clock);
		return list.stream().map(task -> {
			List<AssigneeDto> people = byTask.getOrDefault(task.getId(), List.of())
				.stream()
				.map(a -> new AssigneeDto(a.getStaffId(), staffNames.getOrDefault(a.getStaffId(), ""), a.isDone()))
				.toList();
			List<TaskChecklistItem> items = checklistByTask.getOrDefault(task.getId(), List.of());
			boolean open = task.getStatus() != Status.DONE && task.getStatus() != Status.CANCELLED;
			return new TaskItem(task.getId(), task.getSchoolId(), schoolNames.get(task.getSchoolId()), task.getTitle(),
					task.getPriority(), task.getStatus(), task.getDueAt(),
					open && task.getDueAt() != null && task.getDueAt().isBefore(now), task.getCompletedAt(), people,
					(int) items.stream().filter(TaskChecklistItem::isDone).count(), items.size(), task.isTemplate(),
					task.getParentId(), task.getOccurrenceDate(), creators.get(task.getCreatedBy()), task.getCreatedAt(),
					canEdit(task), allowedStatuses(task));
		}).toList();
	}

	private List<HistoryItem> history(UUID taskId) {
		List<AuditLog> logs = auditLogs.findByEntityInAndEntityIdInOrderByCreatedAtDesc(Set.of(AUDIT_ENTITY),
				List.of(taskId));
		Map<UUID, String> names = userNames(logs.stream().map(AuditLog::getUserId).toList());
		return logs.stream()
			.map(log -> new HistoryItem(log.getCreatedAt(), names.get(log.getUserId()), describe(log)))
			.toList();
	}

	/** Một dòng lịch sử: tạo việc, đổi trạng thái, hay sửa nội dung (đọc từ snapshot đã ghi). */
	private String describe(AuditLog log) {
		if (log.getAction() == Action.CREATE) {
			return "Tạo việc";
		}
		Map<String, Object> after = parse(log.getAfterData());
		// Đổi trạng thái ghi đúng một trường "status"; sửa nội dung ghi cả tiêu đề
		if (after != null && after.containsKey("status") && !after.containsKey("title")) {
			return "Chuyển sang " + statusLabel(Status.valueOf(String.valueOf(after.get("status"))));
		}
		return "Cập nhật nội dung việc";
	}

	private Map<String, Object> parse(String json) {
		return json == null ? null : jsonMapper.readValue(json, new TypeReference<Map<String, Object>>() {
		});
	}

	private static String statusLabel(Status status) {
		return switch (status) {
			case NEW -> "Mới";
			case IN_PROGRESS -> "Đang làm";
			case WAITING_APPROVAL -> "Chờ duyệt";
			case DONE -> "Hoàn thành";
			case CANCELLED -> "Đã hủy";
		};
	}

	private void notifyAssigned(Task task, List<Staff> members) {
		for (Staff staff : members) {
			users.findByStaffId(staff.getId())
				.filter(user -> !user.getId().equals(access.myUserId()))
				.ifPresent(user -> notifications.notify(user.getId(), NOTIFY_TYPE, "Bạn được giao việc mới",
						task.getTitle(), "/cong-viec", "task-assigned:" + task.getId() + ":" + staff.getId()));
		}
	}

	private void notifyStatus(Task task, Status from) {
		String title = "Việc \"%s\": %s".formatted(task.getTitle(), statusLabel(task.getStatus()));
		String key = "task-status:" + task.getId() + ":" + from + ":" + task.getStatus();
		if (task.getStatus() == Status.WAITING_APPROVAL) {
			// Chờ duyệt: chỉ người giao việc cần biết
			if (task.getCreatedBy() != null && !task.getCreatedBy().equals(access.myUserId())) {
				notifications.notify(task.getCreatedBy(), NOTIFY_TYPE, title, null, "/cong-viec", key);
			}
			return;
		}
		notifyOthers(task, title, null, key);
	}

	/** Báo cho người nhận việc, trừ người vừa thao tác. */
	private void notifyOthers(Task task, String title, String body, String dedupeKey) {
		for (UUID staffId : assignees.findByTaskId(task.getId()).stream().map(TaskAssignee::getStaffId).toList()) {
			users.findByStaffId(staffId)
				.filter(user -> !user.getId().equals(access.myUserId()))
				.ifPresent(user -> notifications.notify(user.getId(), NOTIFY_TYPE, title, body, "/cong-viec",
						dedupeKey + ":" + user.getId()));
		}
	}

	private Map<UUID, String> userNames(Collection<UUID> ids) {
		List<UUID> clean = ids.stream().filter(Objects::nonNull).distinct().toList();
		// HashMap: get(null) trả null (việc do job sinh không có người tạo); Map.of() thì ném NullPointerException
		Map<UUID, String> names = new java.util.HashMap<>();
		if (!clean.isEmpty()) {
			users.findAllById(clean).forEach(u -> names.put(u.getId(), u.getFullName()));
		}
		return names;
	}

	private UUID requireMyStaffId() {
		UUID staffId = access.myStaffId();
		if (staffId == null) {
			throw ApiException.notFound("Tài khoản của bạn chưa được gắn với hồ sơ nhân viên.");
		}
		return staffId;
	}

	private static Map<String, Object> snapshot(Task task) {
		Map<String, Object> map = new LinkedHashMap<>();
		map.put("title", task.getTitle());
		map.put("priority", task.getPriority().name());
		map.put("status", task.getStatus().name());
		if (task.getDueAt() != null) {
			map.put("dueAt", task.getDueAt().toString());
		}
		return map;
	}

	/** File đính kèm công việc: đã upload xong và không quá 10MB. */
	private StoredFile requireTaskFile(UUID fileId) {
		StoredFile file = fileService.requireAttachable(fileId);
		if (file.getSizeBytes() > MAX_FILE_BYTES) {
			throw ApiException.badRequest("TASK_FILE_TOO_LARGE", "Mỗi file đính kèm công việc tối đa 10MB.");
		}
		return file;
	}

	private Map<UUID, List<FileRef>> commentFileRefs(List<UUID> commentIds) {
		if (commentIds.isEmpty()) {
			return Map.of();
		}
		List<TaskCommentFile> links = commentFiles.findByCommentIdIn(commentIds);
		Map<UUID, StoredFile> files = fileService.findForModule(links.stream().map(TaskCommentFile::getFileId).distinct().toList());
		return links.stream()
			.filter(l -> files.containsKey(l.getFileId()))
			.collect(java.util.stream.Collectors.groupingBy(TaskCommentFile::getCommentId,
					java.util.stream.Collectors.mapping(l -> ref(files.get(l.getFileId())), java.util.stream.Collectors.toList())));
	}

	private static FileRef ref(StoredFile file) {
		return file == null ? null
				: new FileRef(file.getId(), file.getOriginalName(), file.getMimeType(), file.getSizeBytes());
	}

	private static List<UUID> distinct(List<UUID> ids) {
		return ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList();
	}

	private static String trimToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	private static ApiException notFound() {
		return ApiException.notFound("Không tìm thấy công việc.");
	}

	private static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_ERROR", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

}
