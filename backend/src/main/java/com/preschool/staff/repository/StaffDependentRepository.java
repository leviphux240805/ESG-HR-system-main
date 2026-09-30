package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffDependent;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffDependentRepository extends JpaRepository<StaffDependent, UUID> {

	List<StaffDependent> findByStaffIdOrderByFromMonthAsc(UUID staffId);

}
