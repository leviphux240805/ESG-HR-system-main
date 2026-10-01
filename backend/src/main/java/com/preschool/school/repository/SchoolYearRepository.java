package com.preschool.school.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.school.entity.SchoolYear;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolYearRepository extends JpaRepository<SchoolYear, UUID> {

	List<SchoolYear> findAllByOrderByStartDateDesc();

	Optional<SchoolYear> findByCurrentTrue();

	boolean existsByNameIgnoreCase(String name);

	boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

}
