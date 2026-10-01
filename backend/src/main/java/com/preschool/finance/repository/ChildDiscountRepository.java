package com.preschool.finance.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.ChildDiscount;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildDiscountRepository extends JpaRepository<ChildDiscount, UUID> {

	List<ChildDiscount> findByChildIdOrderByFromMonthDesc(UUID childId);

	List<ChildDiscount> findByChildIdIn(Collection<UUID> childIds);

}
