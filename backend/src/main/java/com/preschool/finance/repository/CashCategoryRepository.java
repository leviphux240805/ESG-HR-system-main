package com.preschool.finance.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.finance.entity.CashCategory;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CashCategoryRepository extends JpaRepository<CashCategory, UUID> {

	List<CashCategory> findAllByOrderByDirectionAscOrderNoAscNameAsc();

	Optional<CashCategory> findBySystemCode(String systemCode);

}
