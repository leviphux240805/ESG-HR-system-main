package com.preschool.classroom.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.classroom.entity.ChildAttendance;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildAttendanceRepository extends JpaRepository<ChildAttendance, UUID> {

	List<ChildAttendance> findByClassIdAndAttendDate(UUID classId, LocalDate attendDate);

	List<ChildAttendance> findBySchoolIdAndAttendDate(UUID schoolId, LocalDate attendDate);

	Optional<ChildAttendance> findByChildIdAndAttendDate(UUID childId, LocalDate attendDate);

	List<ChildAttendance> findByChildIdInAndAttendDateBetween(Collection<UUID> childIds, LocalDate from, LocalDate to);

}
