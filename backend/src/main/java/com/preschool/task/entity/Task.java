package com.preschool.task.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/**
 * Một việc được giao. Việc lặp lại: dòng mẫu có {@code recurrenceRule} (không hiện trên bảng việc), job sinh bản việc
 * theo lịch với {@code parentId} = mẫu và {@code occurrenceDate} = ngày của bản đó.
 */
@Entity
@Table(name = "tasks")
@Filter(name = SchoolFilter.NAME)
public class Task extends BaseEntity {

	public enum Priority {
		LOW, MEDIUM, HIGH, URGENT
	}

	public enum Status {
		NEW, IN_PROGRESS, WAITING_APPROVAL, DONE, CANCELLED
	}

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(nullable = false)
	private String title;

	private String description;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Priority priority = Priority.MEDIUM;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status = Status.NEW;

	@Column(name = "due_at")
	private Instant dueAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "parent_id")
	private UUID parentId;

	@Column(name = "recurrence_rule")
	private String recurrenceRule;

	@Column(name = "occurrence_date")
	private LocalDate occurrenceDate;

	protected Task() {
	}

	public Task(UUID schoolId, String title, String description, Priority priority, Instant dueAt) {
		this.schoolId = schoolId;
		this.title = title;
		this.description = description;
		this.priority = priority;
		this.dueAt = dueAt;
	}

	/** Bản việc sinh từ mẫu lặp lại cho ngày {@code date}. */
	public static Task occurrenceOf(Task template, LocalDate date, Instant dueAt) {
		Task task = new Task(template.schoolId, template.title, template.description, template.priority, dueAt);
		task.parentId = template.getId();
		task.occurrenceDate = date;
		return task;
	}

	public boolean isTemplate() {
		return recurrenceRule != null;
	}

	public void update(String title, String description, Priority priority, Instant dueAt) {
		this.title = title;
		this.description = description;
		this.priority = priority;
		this.dueAt = dueAt;
	}

	public void changeStatus(Status status, Instant at) {
		this.status = status;
		this.completedAt = status == Status.DONE ? at : null;
	}

	public void setRecurrenceRule(String recurrenceRule) {
		this.recurrenceRule = recurrenceRule;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public Priority getPriority() {
		return priority;
	}

	public Status getStatus() {
		return status;
	}

	public Instant getDueAt() {
		return dueAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public UUID getParentId() {
		return parentId;
	}

	public String getRecurrenceRule() {
		return recurrenceRule;
	}

	public LocalDate getOccurrenceDate() {
		return occurrenceDate;
	}

}
