package com.preschool.finance.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.Payment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

	List<Payment> findByInvoiceIdOrderByPaidOnAscCreatedAtAsc(UUID invoiceId);

}
