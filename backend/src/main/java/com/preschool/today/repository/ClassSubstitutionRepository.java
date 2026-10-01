package com.preschool.today.repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import com.preschool.today.entity.ClassSubstitution;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassSubstitutionRepository extends JpaRepository<ClassSubstitution, UUID> {

	Optional<ClassSubstitution> findByClassIdAndAbsentStaffIdAndDate(UUID classId, UUID absentStaffId, LocalDate date);

}
