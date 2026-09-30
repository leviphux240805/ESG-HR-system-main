package com.preschool.staff.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffSchoolAssignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffSchoolAssignmentRepository extends JpaRepository<StaffSchoolAssignment, UUID> {

	List<StaffSchoolAssignment> findByStaffIdOrderByFromDateAsc(UUID staffId);

	/** Điều chuyển đã tới ngày hiệu lực nhưng hồ sơ chưa đổi cơ sở (job hằng ngày áp dụng). */
	@Query(value = """
			SELECT a.* FROM staff_school_assignments a JOIN staff s ON s.id = a.staff_id
			WHERE a.to_date IS NULL AND a.from_date <= :today AND s.school_id <> a.school_id
			  AND s.deleted_at IS NULL AND s.status = 'ACTIVE'""", nativeQuery = true)
	List<StaffSchoolAssignment> findDueTransfers(@Param("today") LocalDate today);

}
