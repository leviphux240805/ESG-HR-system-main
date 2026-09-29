package com.preschool.security;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Cấp access token. Token chỉ mang id người dùng ({@code sub}); vai trò và cơ sở được nạp từ DB mỗi request
 * nên đổi quyền hay khóa tài khoản có hiệu lực ngay.
 */
@Service
public class JwtService {

	static final String ISSUER = "preschool";

	private final JwtEncoder encoder;

	private final AuthProperties props;

	private final Clock clock;

	public JwtService(JwtEncoder encoder, AuthProperties props, Clock clock) {
		this.encoder = encoder;
		this.props = props;
		this.clock = clock;
	}

	public AccessToken issue(UUID userId) {
		Instant now = clock.instant();
		Instant expiresAt = now.plus(props.accessTokenTtl());
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer(ISSUER)
			.subject(userId.toString())
			.issuedAt(now)
			.expiresAt(expiresAt)
			.id(UUID.randomUUID().toString())
			.build();
		String token = encoder
			.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
			.getTokenValue();
		return new AccessToken(token, props.accessTokenTtl().toSeconds());
	}

	public record AccessToken(String value, long expiresInSeconds) {
	}

}
