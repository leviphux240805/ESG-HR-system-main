package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffTraining;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffTrainingRepository extends JpaRepository<StaffTraining, UUID> {

	List<StaffTraining> findByStaffIdOrderByStartDateDesc(UUID staffId);

}
