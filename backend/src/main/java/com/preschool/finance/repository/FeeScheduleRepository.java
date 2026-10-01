package com.preschool.finance.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.finance.entity.FeeSchedule;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FeeScheduleRepository extends JpaRepository<FeeSchedule, UUID> {

	List<FeeSchedule> findBySchoolIdAndSchoolYearIdOrderByEffectiveFromDesc(UUID schoolId, UUID schoolYearId);

	List<FeeSchedule> findBySchoolIdInAndSchoolYearIdAndEffectiveFromLessThanEqual(Collection<UUID> schoolIds,
			UUID schoolYearId, LocalDate date);

	List<FeeSchedule> findBySchoolIdAndEffectiveFromLessThanEqual(UUID schoolId, LocalDate date);

}
