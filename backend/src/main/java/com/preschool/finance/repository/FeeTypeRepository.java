package com.preschool.finance.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.finance.entity.FeeType;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FeeTypeRepository extends JpaRepository<FeeType, UUID> {

	List<FeeType> findAllByOrderByOrderNoAscNameAsc();

	Optional<FeeType> findByCode(String code);

	Optional<FeeType> findByOrganizationIdAndCode(UUID organizationId, String code);

	boolean existsByCode(String code);

}
