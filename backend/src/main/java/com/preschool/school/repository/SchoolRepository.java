package com.preschool.school.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.school.entity.School;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolRepository extends JpaRepository<School, UUID> {

	List<School> findAllByActiveTrueOrderByCode();

}
