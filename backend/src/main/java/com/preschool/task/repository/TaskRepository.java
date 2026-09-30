package com.preschool.task.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.task.entity.Task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task> {

	/** Mẫu việc lặp lại còn hiệu lực (job sinh bản việc). */
	@Query("select t from Task t where t.recurrenceRule is not null and t.status <> com.preschool.task.entity.Task.Status.CANCELLED")
	List<Task> findActiveTemplates();

	boolean existsByParentIdAndOccurrenceDate(UUID parentId, LocalDate occurrenceDate);

	/** Việc chưa xong có hạn trong khoảng (job nhắc trước hạn). */
	@Query("""
			select t from Task t where t.recurrenceRule is null and t.dueAt >= :from and t.dueAt < :to
			  and t.status not in (com.preschool.task.entity.Task.Status.DONE, com.preschool.task.entity.Task.Status.CANCELLED)""")
	List<Task> findOpenDueBetween(@Param("from") Instant from, @Param("to") Instant to);

}
