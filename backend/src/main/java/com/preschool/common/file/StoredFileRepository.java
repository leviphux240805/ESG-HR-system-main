package com.preschool.common.file;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Truy vấn tự lọc theo cơ sở đang chọn (Hibernate filter); file cơ sở khác coi như không tồn tại. */
public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {

	/** Native query: không qua filter cơ sở. Chỉ dùng khi module đã kiểm tra quyền (FileService.findForModule). */
	@Query(value = "SELECT * FROM files WHERE id IN (:ids)", nativeQuery = true)
	List<StoredFile> findAllByIdUnscoped(@Param("ids") Collection<UUID> ids);

}
