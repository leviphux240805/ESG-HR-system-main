package com.preschool.account.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.RefreshToken;
import com.preschool.account.entity.User;
import com.preschool.account.repository.RefreshTokenRepository;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.error.ApiException;
import com.preschool.security.AuthProperties;
import com.preschool.security.JwtService;
import com.preschool.security.JwtService.AccessToken;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Đăng nhập, xoay vòng refresh token và đăng xuất. */
@Service
public class AuthService {

	private static final Logger log = LoggerFactory.getLogger(AuthService.class);

	private static final SecureRandom RANDOM = new SecureRandom();

	private final UserRepository users;

	private final RefreshTokenRepository refreshTokens;

	private final PasswordEncoder passwordEncoder;

	private final JwtService jwtService;

	private final AuthProperties props;

	private final Clock clock;

	/** Hash giả để so khớp khi không tìm thấy tài khoản, giữ thời gian phản hồi như nhau. */
	private final String dummyHash;

	public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
			JwtService jwtService, AuthProperties props, Clock clock) {
		this.users = users;
		this.refreshTokens = refreshTokens;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.props = props;
		this.clock = clock;
		this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
	}

	@Transactional
	public AuthResult login(String identifier, String password, boolean rememberMe) {
		Optional<User> found = findByIdentifier(identifier);
		if (found.isEmpty()) {
			passwordEncoder.matches(password, dummyHash);
			throw invalidCredentials();
		}
		User user = found.get();
		if (!passwordEncoder.matches(password, user.getPasswordHash())) {
			throw invalidCredentials();
		}
		if (!user.isActive()) {
			throw accountDisabled();
		}
		Instant now = clock.instant();
		user.setLastLoginAt(now);
		return issueTokens(user, UUID.randomUUID(), rememberMe, now);
	}

	/**
	 * Đổi refresh token lấy cặp token mới. Token cũ bị thu hồi; dùng lại token đã thu hồi (sau khoảng ân hạn)
	 * được coi là bị đánh cắp và thu hồi toàn bộ family.
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public AuthResult refresh(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			throw refreshInvalid();
		}
		RefreshToken token = refreshTokens.findByTokenHash(hash(rawToken)).orElseThrow(AuthService::refreshInvalid);
		Instant now = clock.instant();

		if (token.getRevokedAt() != null) {
			boolean concurrentRefresh = token.getRevokedAt().isAfter(now.minus(props.refreshReuseGrace()));
			if (!concurrentRefresh) {
				log.warn("Refresh token đã thu hồi bị dùng lại, thu hồi cả family {} của user {}",
						token.getFamilyId(), token.getUser().getId());
				refreshTokens.revokeFamily(token.getFamilyId(), now);
			}
			throw refreshInvalid();
		}
		if (!token.getExpiresAt().isAfter(now)) {
			throw refreshInvalid();
		}
		User user = token.getUser();
		if (!user.isActive()) {
			refreshTokens.revokeFamily(token.getFamilyId(), now);
			throw accountDisabled();
		}
		token.revoke(now);
		return issueTokens(user, token.getFamilyId(), token.isRememberMe(), now);
	}

	/** Thu hồi cả family của token (đăng xuất khỏi phiên này). Token không hợp lệ thì bỏ qua. */
	@Transactional
	public void logout(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return;
		}
		refreshTokens.findByTokenHash(hash(rawToken))
			.ifPresent(token -> refreshTokens.revokeFamily(token.getFamilyId(), clock.instant()));
	}

	private AuthResult issueTokens(User user, UUID familyId, boolean rememberMe, Instant now) {
		String rawRefresh = newRawToken();
		refreshTokens.save(new RefreshToken(user, hash(rawRefresh), familyId, rememberMe,
				now.plus(props.refreshTokenTtl())));
		return new AuthResult(jwtService.issue(user.getId()), rawRefresh, rememberMe);
	}

	private Optional<User> findByIdentifier(String identifier) {
		String value = identifier.trim();
		if (value.contains("@")) {
			return users.findByEmail(value.toLowerCase(Locale.ROOT));
		}
		String phone = normalizePhone(value);
		return phone.isEmpty() ? Optional.empty() : users.findByPhone(phone);
	}

	/** Bỏ ký tự không phải số; đổi tiền tố quốc tế 84 thành 0 (+84 912… → 0912…). */
	static String normalizePhone(String raw) {
		String digits = raw.replaceAll("\\D", "");
		if (digits.startsWith("84") && digits.length() == 11) {
			return "0" + digits.substring(2);
		}
		return digits;
	}

	static String hash(String rawToken) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static String newRawToken() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private static ApiException invalidCredentials() {
		return ApiException.unauthorized("INVALID_CREDENTIALS", "Email/số điện thoại hoặc mật khẩu không đúng.");
	}

	private static ApiException accountDisabled() {
		return new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED",
				"Tài khoản đã bị khóa. Vui lòng liên hệ văn phòng điều hành.");
	}

	private static ApiException refreshInvalid() {
		return ApiException.unauthorized("REFRESH_INVALID", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
	}

	public record AuthResult(AccessToken accessToken, String refreshToken, boolean rememberMe) {
	}

}
