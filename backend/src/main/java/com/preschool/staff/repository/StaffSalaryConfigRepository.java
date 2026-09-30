package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffSalaryConfig;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffSalaryConfigRepository extends JpaRepository<StaffSalaryConfig, UUID> {

	List<StaffSalaryConfig> findByStaffIdOrderByEffectiveFromDesc(UUID staffId);

	boolean existsByStaffIdAndEffectiveFrom(UUID staffId, java.time.LocalDate effectiveFrom);

}
