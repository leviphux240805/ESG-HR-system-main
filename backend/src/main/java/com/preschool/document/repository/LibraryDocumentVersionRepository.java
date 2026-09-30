package com.preschool.document.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.document.entity.LibraryDocumentVersion;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LibraryDocumentVersionRepository extends JpaRepository<LibraryDocumentVersion, UUID> {

	List<LibraryDocumentVersion> findByDocumentIdOrderByVersionNoDesc(UUID documentId);

	Optional<LibraryDocumentVersion> findByDocumentIdAndVersionNo(UUID documentId, int versionNo);

}
