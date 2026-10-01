package com.preschool.classroom.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.classroom.entity.ChildGuardian;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChildGuardianRepository extends JpaRepository<ChildGuardian, UUID> {

	List<ChildGuardian> findByChildId(UUID childId);

	List<ChildGuardian> findByChildIdIn(Collection<UUID> childIds);

	List<ChildGuardian> findByChildIdAndCanPickUpTrue(UUID childId);

	List<ChildGuardian> findByGuardianIdIn(Collection<UUID> guardianIds);

	boolean existsByChildIdAndGuardianId(UUID childId, UUID guardianId);

}
