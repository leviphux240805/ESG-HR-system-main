package com.preschool.classroom.repository;

import java.util.UUID;

import com.preschool.classroom.entity.Child;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChildRepository extends JpaRepository<Child, UUID>, JpaSpecificationExecutor<Child> {

	/** Trùng mã định danh cá nhân trên toàn chuỗi (kể cả cơ sở ngoài phạm vi xem). */
	@Query(value = """
			SELECT EXISTS (SELECT 1 FROM children
			  WHERE deleted_at IS NULL AND personal_id = :value AND (:exclude IS NULL OR id <> :exclude))""",
			nativeQuery = true)
	boolean personalIdTaken(@Param("value") String value, @Param("exclude") UUID excludeChildId);

}
