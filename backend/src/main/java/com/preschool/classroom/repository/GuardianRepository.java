package com.preschool.classroom.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.Guardian;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GuardianRepository extends JpaRepository<Guardian, UUID> {

	List<Guardian> findBySchoolIdAndPhone(UUID schoolId, String phone);

	List<Guardian> findByIdIn(Collection<UUID> ids);

}
