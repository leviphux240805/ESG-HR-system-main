package com.preschool.account.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByEmail(String email);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByPhone(String phone);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findWithRolesById(UUID id);

	@EntityGraph(attributePaths = "roles")
	Optional<User> findByStaffId(UUID staffId);

	/** Tài khoản đang hoạt động có vai trò: `schoolId` rỗng = vai trò toàn chuỗi, có giá trị = đúng cơ sở đó. */
	@Query("""
			select distinct u from User u join u.roles r
			where u.active = true and r.roleCode = :role
			  and ((:schoolId is null and r.schoolId is null) or r.schoolId = :schoolId)""")
	List<User> findActiveByRole(@Param("role") RoleCode role, @Param("schoolId") UUID schoolId);

	boolean existsByEmail(String email);

	boolean existsByPhone(String phone);

}
