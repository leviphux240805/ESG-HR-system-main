package com.preschool.classroom.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ChildAttendanceConfig;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChildAttendanceConfigRepository extends JpaRepository<ChildAttendanceConfig, UUID> {

	/** Bản hiệu lực tại ngày `date` của cơ sở (mới nhất trước); `schoolId` rỗng lấy bản mặc định toàn chuỗi. */
	@Query("""
			select c from ChildAttendanceConfig c
			where (:schoolId is null and c.schoolId is null or c.schoolId = :schoolId)
			  and c.effectiveFrom <= :date
			order by c.effectiveFrom desc""")
	List<ChildAttendanceConfig> findEffective(@Param("schoolId") UUID schoolId, @Param("date") LocalDate date);

}
