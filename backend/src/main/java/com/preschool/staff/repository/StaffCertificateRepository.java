package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffCertificate;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffCertificateRepository extends JpaRepository<StaffCertificate, UUID> {

	List<StaffCertificate> findByStaffIdOrderByIssueDateDesc(UUID staffId);

}
