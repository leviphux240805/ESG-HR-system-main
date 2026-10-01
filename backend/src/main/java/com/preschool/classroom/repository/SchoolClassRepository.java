package com.preschool.classroom.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.SchoolClass;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SchoolClassRepository extends JpaRepository<SchoolClass, UUID> {

	List<SchoolClass> findBySchoolIdAndSchoolYearIdOrderByName(UUID schoolId, UUID schoolYearId);

	List<SchoolClass> findBySchoolYearIdOrderByName(UUID schoolYearId);

	List<SchoolClass> findByIdIn(Collection<UUID> ids);

	boolean existsBySchoolIdAndSchoolYearIdAndName(UUID schoolId, UUID schoolYearId, String name);

	boolean existsBySchoolIdAndSchoolYearIdAndNameAndIdNot(UUID schoolId, UUID schoolYearId, String name, UUID id);

	boolean existsBySchoolYearId(UUID schoolYearId);

}
