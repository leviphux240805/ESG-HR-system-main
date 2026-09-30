package com.preschool.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.attendance.entity.StaffAttendanceDay;

import org.springframework.data.jpa.repository.JpaRepository;

/** Bảng công ngày (đã lọc theo cơ sở). */
public interface StaffAttendanceDayRepository extends JpaRepository<StaffAttendanceDay, UUID> {

	List<StaffAttendanceDay> findBySchoolIdAndWorkDateBetween(UUID schoolId, LocalDate from, LocalDate to);

	List<StaffAttendanceDay> findByStaffIdAndWorkDateBetween(UUID staffId, LocalDate from, LocalDate to);

	Optional<StaffAttendanceDay> findByStaffIdAndWorkDate(UUID staffId, LocalDate workDate);

}
