package com.preschool.task.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

@Entity
@Table(name = "task_comments")
@Filter(name = SchoolFilter.NAME)
public class TaskComment extends BaseEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "task_id", nullable = false)
	private UUID taskId;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false)
	private String body;

	@Column(name = "file_id")
	private UUID fileId;

	protected TaskComment() {
	}

	public TaskComment(UUID schoolId, UUID taskId, UUID userId, String body, UUID fileId) {
		this.schoolId = schoolId;
		this.taskId = taskId;
		this.userId = userId;
		this.body = body;
		this.fileId = fileId;
	}

	public UUID getTaskId() {
		return taskId;
	}

	public UUID getUserId() {
		return userId;
	}

	public String getBody() {
		return body;
	}

	public UUID getFileId() {
		return fileId;
	}

}
