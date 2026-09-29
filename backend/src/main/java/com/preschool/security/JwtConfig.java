package com.preschool.security;

import java.nio.charset.StandardCharsets;
import java.time.Clock;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class JwtConfig {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}

	@Bean
	JwtEncoder jwtEncoder(AuthProperties props) {
		return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(props)));
	}

	@Bean
	JwtDecoder jwtDecoder(AuthProperties props) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey(props))
			.macAlgorithm(MacAlgorithm.HS256)
			.build();
		decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(JwtService.ISSUER));
		return decoder;
	}

	private static SecretKey secretKey(AuthProperties props) {
		return new SecretKeySpec(props.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

}
