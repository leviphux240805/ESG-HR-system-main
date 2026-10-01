package com.preschool.health.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.health.entity.HealthCheckup;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HealthCheckupRepository extends JpaRepository<HealthCheckup, UUID> {

	List<HealthCheckup> findByChildIdOrderByCheckupDateDesc(UUID childId);

}
