package com.preschool.classroom.repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import com.preschool.classroom.entity.ChildAttendanceConfig;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildAttendanceConfigRepository extends JpaRepository<ChildAttendanceConfig, UUID> {

	/** Bản hiệu lực tại ngày `date` của một cơ sở. */
	Optional<ChildAttendanceConfig> findFirstBySchoolIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
			UUID schoolId, LocalDate date);

	/** Bản mặc định của tổ chức hiệu lực tại ngày `date`. */
	Optional<ChildAttendanceConfig> findFirstBySchoolIdIsNullAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
			LocalDate date);

}
