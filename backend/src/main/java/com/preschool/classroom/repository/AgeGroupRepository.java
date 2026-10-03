package com.preschool.classroom.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.classroom.entity.AgeGroup;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AgeGroupRepository extends JpaRepository<AgeGroup, UUID> {

	List<AgeGroup> findAllByOrderByOrderNo();

	List<AgeGroup> findAllByOrganizationIdOrderByOrderNo(UUID organizationId);

	Optional<AgeGroup> findByCode(String code);

	Optional<AgeGroup> findByOrganizationIdAndCode(UUID organizationId, String code);

}
