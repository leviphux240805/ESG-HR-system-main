package com.preschool.document.repository;

import java.util.Optional;
import java.util.UUID;

import com.preschool.document.entity.DocumentAck;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentAckRepository extends JpaRepository<DocumentAck, UUID> {

	boolean existsByDocumentIdAndStaffIdAndVersionNo(UUID documentId, UUID staffId, int versionNo);

	/** Lần xác nhận mới nhất của nhân viên cho văn bản (phiên bản cao nhất). */
	Optional<DocumentAck> findFirstByDocumentIdAndStaffIdOrderByVersionNoDesc(UUID documentId, UUID staffId);

}
