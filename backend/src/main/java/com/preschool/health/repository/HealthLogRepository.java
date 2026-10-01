package com.preschool.health.repository;

import java.util.UUID;

import com.preschool.health.entity.HealthLog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface HealthLogRepository extends JpaRepository<HealthLog, UUID>, JpaSpecificationExecutor<HealthLog> {

}
