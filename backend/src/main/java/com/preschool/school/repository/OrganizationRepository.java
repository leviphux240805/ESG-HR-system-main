package com.preschool.school.repository;

import java.util.UUID;

import com.preschool.school.entity.Organization;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

}
