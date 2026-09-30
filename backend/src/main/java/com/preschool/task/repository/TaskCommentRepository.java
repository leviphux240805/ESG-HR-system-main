package com.preschool.task.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.task.entity.TaskComment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskCommentRepository extends JpaRepository<TaskComment, UUID> {

	List<TaskComment> findByTaskIdOrderByCreatedAt(UUID taskId);

}
