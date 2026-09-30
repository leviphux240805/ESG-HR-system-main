package com.preschool.attendance.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.attendance.entity.AttendancePunch;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendancePunchRepository extends JpaRepository<AttendancePunch, UUID> {

	List<AttendancePunch> findBySchoolIdAndWorkDateBetween(UUID schoolId, LocalDate from, LocalDate to);

	List<AttendancePunch> findByStaffIdInAndWorkDateBetween(Collection<UUID> staffIds, LocalDate from, LocalDate to);

	Optional<AttendancePunch> findByStaffIdAndWorkDate(UUID staffId, LocalDate workDate);

}
