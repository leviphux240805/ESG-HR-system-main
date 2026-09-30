package com.preschool.classroom.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ChildDocument;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildDocumentRepository extends JpaRepository<ChildDocument, UUID> {

	List<ChildDocument> findByChildIdOrderByCreatedAtDesc(UUID childId);

}
