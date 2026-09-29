package com.preschool.account.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.PasswordResetToken;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

	@EntityGraph(attributePaths = "user")
	Optional<PasswordResetToken> findByTokenHash(String tokenHash);

	boolean existsByUserIdAndCreatedAtAfter(UUID userId, Instant after);

	/** Vô hiệu các link cũ chưa dùng khi phát link mới hoặc đã đổi mật khẩu. */
	@Modifying
	@Query("update PasswordResetToken t set t.usedAt = :now where t.user.id = :userId and t.usedAt is null")
	int invalidateAll(@Param("userId") UUID userId, @Param("now") Instant now);

}
