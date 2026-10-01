package com.preschool.account.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByEmail(String email);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByPhone(String phone);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findWithRolesById(UUID id);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByStaffId(UUID staffId);

	/** Tài khoản đang hoạt động có vai trò {@code role} ở trường {@code schoolId}. */
	@Query("""
			select distinct u from User u join u.roles r
			where u.active = true and r.roleCode = :role and r.schoolId = :schoolId""")
	List<User> findActiveByRole(@Param("role") RoleCode role, @Param("schoolId") UUID schoolId);

	boolean existsByEmail(String email);

	boolean existsByPhone(String phone);

}
