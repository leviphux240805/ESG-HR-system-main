package com.preschool.task.entity;

import java.util.UUID;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

@Entity
@Table(name = "task_checklist_items")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class TaskChecklistItem extends OrganizationEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "task_id", nullable = false)
	private UUID taskId;

	@Column(nullable = false)
	private String content;

	@Column(name = "is_done", nullable = false)
	private boolean done;

	@Column(name = "order_no", nullable = false)
	private int orderNo;

	protected TaskChecklistItem() {
	}

	public TaskChecklistItem(UUID schoolId, UUID taskId, String content, int orderNo) {
		this.schoolId = schoolId;
		this.taskId = taskId;
		this.content = content;
		this.orderNo = orderNo;
	}

	public void setDone(boolean done) {
		this.done = done;
	}

	public UUID getTaskId() {
		return taskId;
	}

	public String getContent() {
		return content;
	}

	public boolean isDone() {
		return done;
	}

	public int getOrderNo() {
		return orderNo;
	}

}
