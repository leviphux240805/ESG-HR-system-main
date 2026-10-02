package com.preschool.task.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.task.entity.TaskCommentFile;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskCommentFileRepository extends JpaRepository<TaskCommentFile, UUID> {

	List<TaskCommentFile> findByCommentIdIn(Collection<UUID> commentIds);

}
