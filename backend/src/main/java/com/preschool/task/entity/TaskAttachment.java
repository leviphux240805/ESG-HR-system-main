package com.preschool.task.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

@Entity
@Table(name = "task_attachments")
@Filter(name = SchoolFilter.NAME)
public class TaskAttachment extends BaseEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "task_id", nullable = false)
	private UUID taskId;

	@Column(name = "file_id", nullable = false)
	private UUID fileId;

	protected TaskAttachment() {
	}

	public TaskAttachment(UUID schoolId, UUID taskId, UUID fileId) {
		this.schoolId = schoolId;
		this.taskId = taskId;
		this.fileId = fileId;
	}

	public UUID getTaskId() {
		return taskId;
	}

	public UUID getFileId() {
		return fileId;
	}

}
