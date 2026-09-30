package com.preschool.task.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.task.entity.TaskChecklistItem;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskChecklistItemRepository extends JpaRepository<TaskChecklistItem, UUID> {

	List<TaskChecklistItem> findByTaskIdOrderByOrderNo(UUID taskId);

	List<TaskChecklistItem> findByTaskIdIn(Collection<UUID> taskIds);

}
