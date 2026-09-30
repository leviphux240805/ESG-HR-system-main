package com.preschool.payroll.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.payroll.entity.PayrollPeriod;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollPeriodRepository extends JpaRepository<PayrollPeriod, UUID> {

	Optional<PayrollPeriod> findBySchoolIdAndMonth(UUID schoolId, LocalDate month);

	List<PayrollPeriod> findByMonthOrderByCreatedAt(LocalDate month);

	List<PayrollPeriod> findBySchoolIdOrderByMonthDesc(UUID schoolId);

}
