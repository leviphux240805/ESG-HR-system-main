package com.preschool.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityProblemHandlers problemHandlers,
			SchoolAccessService accessService) throws Exception {
		http
			// API không dùng session/cookie để xác thực (trừ cookie refresh SameSite=Strict), nên tắt CSRF
			.csrf(csrf -> csrf.disable())
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.exceptionHandling(e -> e.authenticationEntryPoint(problemHandlers).accessDeniedHandler(problemHandlers))
			.oauth2ResourceServer(rs -> rs.jwt(jwt -> {
			}).authenticationEntryPoint(problemHandlers).accessDeniedHandler(problemHandlers))
			// Sau khi xác thực JWT: nạp phạm vi cơ sở, kiểm tra X-School-Id
			.addFilterAfter(new SchoolScopeFilter(accessService, problemHandlers),
					BearerTokenAuthenticationFilter.class)
			.authorizeHttpRequests(auth -> auth
				.requestMatchers("/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll()
				.requestMatchers("/error").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout",
						"/api/v1/auth/forgot-password", "/api/v1/auth/reset-password")
				.permitAll()
				.anyRequest().authenticated());
		return http.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

}
