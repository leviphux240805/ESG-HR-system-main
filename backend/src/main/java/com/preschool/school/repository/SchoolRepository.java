package com.preschool.school.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.school.entity.School;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolRepository extends JpaRepository<School, UUID> {

	List<School> findAllByOrganizationIdAndActiveTrueOrderByCode(UUID organizationId);

	List<School> findAllByIdInOrderByCode(Collection<UUID> ids);

	boolean existsByOrganizationIdAndCodeIgnoreCaseAndIdNot(UUID organizationId, String code, UUID id);

	boolean existsByOrganizationIdAndCodeIgnoreCase(UUID organizationId, String code);

	boolean existsByParentId(UUID parentId);

}
