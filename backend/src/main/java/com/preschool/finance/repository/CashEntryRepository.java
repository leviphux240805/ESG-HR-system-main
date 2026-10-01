package com.preschool.finance.repository;

import java.util.Optional;
import java.util.UUID;

import com.preschool.finance.entity.CashEntry;
import com.preschool.finance.entity.FinanceEnums.CashSource;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CashEntryRepository extends JpaRepository<CashEntry, UUID>, JpaSpecificationExecutor<CashEntry> {

	Optional<CashEntry> findBySourceAndSourceId(CashSource source, UUID sourceId);

}
