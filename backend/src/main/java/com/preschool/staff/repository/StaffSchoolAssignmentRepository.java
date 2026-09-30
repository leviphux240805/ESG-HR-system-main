package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffSchoolAssignment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffSchoolAssignmentRepository extends JpaRepository<StaffSchoolAssignment, UUID> {

	List<StaffSchoolAssignment> findByStaffIdOrderByFromDateAsc(UUID staffId);

}
