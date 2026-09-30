package com.preschool.document.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.document.entity.DocFolder;

import org.springframework.data.jpa.repository.JpaRepository;

/** Thư mục thư viện (đã lọc theo cơ sở: thư mục chung + thư mục của cơ sở trong phạm vi). */
public interface DocFolderRepository extends JpaRepository<DocFolder, UUID> {

	List<DocFolder> findAllByOrderByNameAsc();

	boolean existsByParentId(UUID parentId);

}
