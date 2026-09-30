package com.preschool.attendance.repository;

import java.util.Optional;
import java.util.UUID;

import com.preschool.attendance.entity.LeaveBalance;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, UUID> {

	Optional<LeaveBalance> findByStaffIdAndYear(UUID staffId, int year);

}
