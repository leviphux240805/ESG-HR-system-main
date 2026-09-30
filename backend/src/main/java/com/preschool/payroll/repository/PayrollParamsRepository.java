package com.preschool.payroll.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.payroll.entity.PayrollParams;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollParamsRepository extends JpaRepository<PayrollParams, UUID> {

	List<PayrollParams> findAllByOrderByEffectiveFromDesc();

	/** Các bản đã hiệu lực tại ngày `date`, mới nhất trước. */
	List<PayrollParams> findByEffectiveFromLessThanEqualOrderByEffectiveFromDesc(LocalDate date);

	boolean existsByEffectiveFrom(LocalDate effectiveFrom);

}
