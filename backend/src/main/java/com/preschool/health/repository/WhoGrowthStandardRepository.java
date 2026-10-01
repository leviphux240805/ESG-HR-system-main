package com.preschool.health.repository;

import java.util.UUID;

import com.preschool.health.entity.WhoGrowthStandard;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WhoGrowthStandardRepository extends JpaRepository<WhoGrowthStandard, UUID> {

}
