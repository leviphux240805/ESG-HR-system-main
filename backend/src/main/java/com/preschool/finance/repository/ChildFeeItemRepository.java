package com.preschool.finance.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.ChildFeeItem;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildFeeItemRepository extends JpaRepository<ChildFeeItem, UUID> {

	List<ChildFeeItem> findByChildIdOrderByFromMonthDesc(UUID childId);

	List<ChildFeeItem> findByChildIdIn(Collection<UUID> childIds);

}
