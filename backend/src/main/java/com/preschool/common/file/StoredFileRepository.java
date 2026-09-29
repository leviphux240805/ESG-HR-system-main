package com.preschool.common.file;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Truy vấn tự lọc theo cơ sở đang chọn (Hibernate filter); file cơ sở khác coi như không tồn tại. */
public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {

}
