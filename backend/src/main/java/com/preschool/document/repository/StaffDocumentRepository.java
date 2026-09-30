package com.preschool.document.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.document.entity.StaffDocument;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffDocumentRepository extends JpaRepository<StaffDocument, UUID> {

	List<StaffDocument> findByStaffIdOrderByCreatedAtDesc(UUID staffId);

}
