package com.preschool.task.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.task.entity.TaskAttachment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, UUID> {

	List<TaskAttachment> findByTaskId(UUID taskId);

}
