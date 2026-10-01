package com.preschool.document.repository;

import java.util.UUID;

import com.preschool.document.entity.LibraryDocument;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** Văn bản thư viện (đã lọc theo cơ sở: văn bản cả tổ chức + văn bản của cơ sở trong phạm vi). */
public interface LibraryDocumentRepository
		extends JpaRepository<LibraryDocument, UUID>, JpaSpecificationExecutor<LibraryDocument> {

	boolean existsByFolderId(UUID folderId);

}
