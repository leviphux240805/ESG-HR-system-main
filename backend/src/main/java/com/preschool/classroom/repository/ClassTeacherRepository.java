package com.preschool.classroom.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ClassTeacher;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassTeacherRepository extends JpaRepository<ClassTeacher, UUID> {

	List<ClassTeacher> findByClassIdAndToDateIsNull(UUID classId);

	List<ClassTeacher> findByClassIdInAndToDateIsNull(Collection<UUID> classIds);

	List<ClassTeacher> findByClassIdOrderByFromDateDesc(UUID classId);

	/** Lớp mà giáo viên đang phụ trách (giáo viên chỉ điểm danh lớp của mình). */
	List<ClassTeacher> findByStaffIdAndToDateIsNull(UUID staffId);

}
