package com.preschool.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.attendance.entity.AttendanceConfig;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceConfigRepository extends JpaRepository<AttendanceConfig, UUID> {

	/** Các bản cấu hình của cơ sở và mặc định của tổ chức, mới nhất trước. */
	@Query("""
			select c from AttendanceConfig c where c.schoolId = :schoolId or c.schoolId is null
			order by c.effectiveFrom desc""")
	List<AttendanceConfig> findForSchool(@Param("schoolId") UUID schoolId);

	@Query("select c from AttendanceConfig c where c.schoolId is null order by c.effectiveFrom desc")
	List<AttendanceConfig> findChainDefaults();

	@Query("""
			select count(c) > 0 from AttendanceConfig c
			where ((:schoolId is null and c.schoolId is null) or c.schoolId = :schoolId) and c.effectiveFrom = :from""")
	boolean existsVersion(@Param("schoolId") UUID schoolId, @Param("from") LocalDate effectiveFrom);

}
