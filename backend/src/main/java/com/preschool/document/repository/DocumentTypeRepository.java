package com.preschool.document.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.document.entity.DocumentType;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentTypeRepository extends JpaRepository<DocumentType, UUID> {

	List<DocumentType> findByScopeAndActiveTrueOrderBySortOrder(DocumentType.Scope scope);

	java.util.Optional<DocumentType> findByCode(String code);

}
