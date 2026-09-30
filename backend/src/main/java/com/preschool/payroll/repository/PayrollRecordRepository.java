package com.preschool.payroll.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.payroll.entity.PayrollRecord;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, UUID> {

	List<PayrollRecord> findByPeriodId(UUID periodId);

	List<PayrollRecord> findByPeriodIdIn(Collection<UUID> periodIds);

	Optional<PayrollRecord> findByPeriodIdAndStaffId(UUID periodId, UUID staffId);

	/** Phiếu lương của một người (trang "Phiếu lương của tôi"). */
	List<PayrollRecord> findByStaffIdOrderByCreatedAtDesc(UUID staffId);

}
