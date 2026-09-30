package com.preschool.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.attendance.entity.StaffAttendanceMonth;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffAttendanceMonthRepository extends JpaRepository<StaffAttendanceMonth, UUID> {

	List<StaffAttendanceMonth> findBySchoolIdAndMonth(UUID schoolId, LocalDate month);

	Optional<StaffAttendanceMonth> findByStaffIdAndMonth(UUID staffId, LocalDate month);

}
