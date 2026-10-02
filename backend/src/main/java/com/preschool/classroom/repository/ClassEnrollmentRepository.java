package com.preschool.classroom.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnrollment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassEnrollmentRepository extends JpaRepository<ClassEnrollment, UUID> {

	Optional<ClassEnrollment> findByChildIdAndToDateIsNull(UUID childId);

	List<ClassEnrollment> findByChildIdInAndToDateIsNull(Collection<UUID> childIds);

	List<ClassEnrollment> findByChildIdOrderByFromDateDesc(UUID childId);

	List<ClassEnrollment> findByClassIdAndToDateIsNull(UUID classId);

	List<ClassEnrollment> findByClassIdInAndToDateIsNull(Collection<UUID> classIds);

	long countByClassIdAndToDateIsNull(UUID classId);

	boolean existsByClassId(UUID classId);

	/** Trẻ thuộc lớp vào ngày `date` (kể cả đã chuyển đi sau ngày đó). */
	@Query("""
			select e from ClassEnrollment e
			where e.classId = :classId and e.fromDate <= :date and (e.toDate is null or e.toDate >= :date)""")
	List<ClassEnrollment> findInClassOn(@Param("classId") UUID classId, @Param("date") LocalDate date);

	/** Các đợt học của lớp giao với khoảng [from, to] (sổ điểm danh tháng). */
	@Query("""
			select e from ClassEnrollment e
			where e.classId = :classId and e.fromDate <= :to and (e.toDate is null or e.toDate >= :from)""")
	List<ClassEnrollment> findInClassBetween(@Param("classId") UUID classId, @Param("from") LocalDate from,
			@Param("to") LocalDate to);

	/** Các đợt học của cơ sở giao với khoảng [from, to] (để sinh phiếu thu theo tháng). */
	@Query("""
			select e from ClassEnrollment e
			where e.schoolId = :schoolId and e.fromDate <= :to and (e.toDate is null or e.toDate >= :from)""")
	List<ClassEnrollment> findOverlapping(@Param("schoolId") UUID schoolId, @Param("from") LocalDate from,
			@Param("to") LocalDate to);

}
