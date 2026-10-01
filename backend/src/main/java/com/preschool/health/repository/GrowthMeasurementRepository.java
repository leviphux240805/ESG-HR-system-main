package com.preschool.health.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.health.entity.GrowthMeasurement;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GrowthMeasurementRepository extends JpaRepository<GrowthMeasurement, UUID> {

	List<GrowthMeasurement> findByChildIdOrderByMeasuredOn(UUID childId);

	List<GrowthMeasurement> findByChildIdInOrderByMeasuredOn(Collection<UUID> childIds);

	Optional<GrowthMeasurement> findByChildIdAndMeasuredOn(UUID childId, LocalDate measuredOn);

	List<GrowthMeasurement> findBySchoolIdInAndMeasuredOnBetween(Collection<UUID> schoolIds, LocalDate from,
			LocalDate to);

}
