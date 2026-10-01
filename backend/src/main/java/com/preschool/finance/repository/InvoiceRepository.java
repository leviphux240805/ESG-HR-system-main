package com.preschool.finance.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.entity.Invoice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID>, JpaSpecificationExecutor<Invoice> {

	@Query("select i from Invoice i where i.childId = :childId and i.periodMonth = :month and i.status <> 'CANCELLED'")
	Optional<Invoice> findActive(@Param("childId") UUID childId, @Param("month") LocalDate month);

	@Query("select i from Invoice i where i.schoolId = :schoolId and i.periodMonth = :month and i.status <> 'CANCELLED'")
	List<Invoice> findActiveBySchoolAndMonth(@Param("schoolId") UUID schoolId, @Param("month") LocalDate month);

	List<Invoice> findByChildIdOrderByPeriodMonthDesc(UUID childId);

	/** Phiếu đã phát hành còn mở, trước tháng, để chuyển số dư. */
	List<Invoice> findByChildIdAndStatusInAndPeriodMonthBefore(UUID childId, Collection<InvoiceStatus> statuses,
			LocalDate month);

	List<Invoice> findByCarriedToId(UUID invoiceId);

	@Query("select count(i) from Invoice i where i.schoolId = :schoolId and i.invoiceNo like :prefix%")
	long countByNoPrefix(@Param("schoolId") UUID schoolId, @Param("prefix") String prefix);

}
