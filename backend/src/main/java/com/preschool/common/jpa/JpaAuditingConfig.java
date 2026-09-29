package com.preschool.common.jpa;

import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "currentUserAuditor")
public class JpaAuditingConfig {

	/** created_by = id người dùng đang đăng nhập (subject của JWT); không có thì để rỗng. */
	@Bean
	AuditorAware<UUID> currentUserAuditor() {
		return () -> {
			Authentication auth = SecurityContextHolder.getContext().getAuthentication();
			if (auth == null || !auth.isAuthenticated()) {
				return Optional.empty();
			}
			try {
				return Optional.of(UUID.fromString(auth.getName()));
			}
			catch (IllegalArgumentException ex) {
				return Optional.empty();
			}
		};
	}

}
