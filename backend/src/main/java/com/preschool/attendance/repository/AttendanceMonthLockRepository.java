package com.preschool.attendance.repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import com.preschool.attendance.entity.AttendanceMonthLock;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceMonthLockRepository extends JpaRepository<AttendanceMonthLock, UUID> {

	Optional<AttendanceMonthLock> findBySchoolIdAndMonth(UUID schoolId, LocalDate month);

	boolean existsBySchoolIdAndMonth(UUID schoolId, LocalDate month);

}
