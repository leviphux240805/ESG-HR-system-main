package com.preschool.task.entity;

import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Một file đính kèm trong bình luận công việc. */
@Entity
@Table(name = "task_comment_files")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class TaskCommentFile extends OrganizationEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "comment_id", nullable = false)
	private UUID commentId;

	@Column(name = "file_id", nullable = false)
	private UUID fileId;

	protected TaskCommentFile() {
	}

	public TaskCommentFile(UUID schoolId, UUID commentId, UUID fileId) {
		this.schoolId = schoolId;
		this.commentId = commentId;
		this.fileId = fileId;
	}

	public UUID getCommentId() {
		return commentId;
	}

	public UUID getFileId() {
		return fileId;
	}

}
