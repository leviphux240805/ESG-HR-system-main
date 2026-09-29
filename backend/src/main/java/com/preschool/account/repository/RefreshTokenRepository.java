package com.preschool.account.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.RefreshToken;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

	@EntityGraph(attributePaths = "user")
	Optional<RefreshToken> findByTokenHash(String tokenHash);

	@Modifying
	@Query("update RefreshToken t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
	int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

}
