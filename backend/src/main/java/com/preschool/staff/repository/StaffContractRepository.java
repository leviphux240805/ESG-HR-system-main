package com.preschool.staff.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffContract;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffContractRepository extends JpaRepository<StaffContract, UUID> {

	List<StaffContract> findByStaffIdOrderByStartDateDesc(UUID staffId);

	interface ContractEnd {

		UUID getStaffId();

		LocalDate getEndDate();

	}

	/** Hạn của hợp đồng hiện hành (bắt đầu muộn nhất) cho từng nhân viên. */
	@Query(value = """
			SELECT DISTINCT ON (staff_id) staff_id AS staffId, end_date AS endDate
			FROM staff_contracts WHERE staff_id IN (:staffIds)
			ORDER BY staff_id, start_date DESC""", nativeQuery = true)
	List<ContractEnd> findCurrentContractEnds(@Param("staffIds") Collection<UUID> staffIds);

}
