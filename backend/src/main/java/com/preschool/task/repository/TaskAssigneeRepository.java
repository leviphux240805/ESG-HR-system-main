package com.preschool.task.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.task.entity.TaskAssignee;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, UUID> {

	List<TaskAssignee> findByTaskIdIn(Collection<UUID> taskIds);

	List<TaskAssignee> findByTaskId(UUID taskId);

}
