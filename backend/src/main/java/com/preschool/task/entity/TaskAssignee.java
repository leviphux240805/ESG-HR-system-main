package com.preschool.task.entity;

import java.time.Instant;
import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/** Người nhận việc (nhân viên); mỗi người tự đánh dấu phần mình xong. */
@Entity
@Table(name = "task_assignees")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class TaskAssignee extends OrganizationEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "task_id", nullable = false)
	private UUID taskId;

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(nullable = false)
	private String status = "OPEN";

	@Column(name = "done_at")
	private Instant doneAt;

	protected TaskAssignee() {
	}

	public TaskAssignee(UUID schoolId, UUID taskId, UUID staffId) {
		this.schoolId = schoolId;
		this.taskId = taskId;
		this.staffId = staffId;
	}

	public void markDone(boolean done, Instant at) {
		this.status = done ? "DONE" : "OPEN";
		this.doneAt = done ? at : null;
	}

	public UUID getTaskId() {
		return taskId;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public boolean isDone() {
		return "DONE".equals(status);
	}

	public Instant getDoneAt() {
		return doneAt;
	}

}
