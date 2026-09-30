package com.preschool.classroom.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnrollment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassEnrollmentRepository extends JpaRepository<ClassEnrollment, UUID> {

	Optional<ClassEnrollment> findByChildIdAndToDateIsNull(UUID childId);

	List<ClassEnrollment> findByChildIdInAndToDateIsNull(Collection<UUID> childIds);

	List<ClassEnrollment> findByChildIdOrderByFromDateDesc(UUID childId);

	List<ClassEnrollment> findByClassIdAndToDateIsNull(UUID classId);

	List<ClassEnrollment> findByClassIdInAndToDateIsNull(Collection<UUID> classIds);

	long countByClassIdAndToDateIsNull(UUID classId);

}
