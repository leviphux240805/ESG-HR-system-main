package com.preschool.account.repository;

import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.User;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByEmail(String email);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByPhone(String phone);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findWithRolesById(UUID id);

}
