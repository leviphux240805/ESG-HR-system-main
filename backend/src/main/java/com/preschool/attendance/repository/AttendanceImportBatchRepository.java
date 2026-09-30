package com.preschool.attendance.repository;

import java.util.UUID;

import com.preschool.attendance.entity.AttendanceImportBatch;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceImportBatchRepository extends JpaRepository<AttendanceImportBatch, UUID> {

}
