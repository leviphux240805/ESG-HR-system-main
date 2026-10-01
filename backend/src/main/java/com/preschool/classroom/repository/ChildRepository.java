package com.preschool.classroom.repository;

import java.util.UUID;

import com.preschool.classroom.entity.Child;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChildRepository extends JpaRepository<Child, UUID>, JpaSpecificationExecutor<Child> {

	/** Trùng mã định danh cá nhân trong tổ chức (kể cả trường ngoài phạm vi xem). */
	@Query(value = """
			SELECT EXISTS (SELECT 1 FROM children
			  WHERE deleted_at IS NULL AND personal_id = :value AND school_id IN (SELECT id FROM schools WHERE organization_id = :org)
			    AND (:exclude IS NULL OR id <> :exclude))""",
			nativeQuery = true)
	boolean personalIdTaken(@Param("org") UUID organizationId, @Param("value") String value,
			@Param("exclude") UUID excludeChildId);

}
