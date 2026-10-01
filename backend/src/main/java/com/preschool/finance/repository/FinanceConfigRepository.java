package com.preschool.finance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.FinanceConfig;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FinanceConfigRepository extends JpaRepository<FinanceConfig, UUID> {

	/** Các bản hiệu lực tới ngày cho cơ sở (bản riêng cơ sở đứng trước bản chung). */
	@Query("""
			select c from FinanceConfig c
			where (c.schoolId = :schoolId or c.schoolId is null) and c.effectiveFrom <= :date
			order by case when c.schoolId is null then 1 else 0 end, c.effectiveFrom desc
			""")
	List<FinanceConfig> findEffective(@Param("schoolId") UUID schoolId, @Param("date") LocalDate date);

	@Query("select c from FinanceConfig c where c.schoolId = :schoolId or c.schoolId is null order by c.effectiveFrom desc")
	List<FinanceConfig> findHistory(@Param("schoolId") UUID schoolId);

}
