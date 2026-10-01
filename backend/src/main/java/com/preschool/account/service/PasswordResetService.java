package com.preschool.account.service;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import com.preschool.account.entity.PasswordResetToken;
import com.preschool.account.entity.User;
import com.preschool.account.repository.PasswordResetTokenRepository;
import com.preschool.account.repository.RefreshTokenRepository;
import com.preschool.common.error.ApiException;
import com.preschool.common.mail.EmailService;
import com.preschool.common.mail.MailProperties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

/** Quên mật khẩu: gửi link đặt lại qua email, đặt mật khẩu mới bằng link đó. */
@Service
public class PasswordResetService {

	private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

	static final Duration TOKEN_TTL = Duration.ofMinutes(30);

	/** Link mời đặt mật khẩu cho tài khoản mới. */
	static final Duration INVITE_TTL = Duration.ofDays(7);

	/** Mỗi tài khoản chỉ được xin link mới sau khoảng này (chống spam email). */
	static final Duration REQUEST_COOLDOWN = Duration.ofMinutes(1);

	/** BCrypt chỉ dùng 72 byte đầu của mật khẩu. */
	private static final int MAX_PASSWORD_BYTES = 72;

	private final AuthService authService;

	private final PasswordResetTokenRepository resetTokens;

	private final RefreshTokenRepository refreshTokens;

	private final PasswordEncoder passwordEncoder;

	private final EmailService emailService;

	private final MailProperties mailProps;

	private final Clock clock;

	public PasswordResetService(AuthService authService, PasswordResetTokenRepository resetTokens,
			RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder, EmailService emailService,
			MailProperties mailProps, Clock clock) {
		this.authService = authService;
		this.resetTokens = resetTokens;
		this.refreshTokens = refreshTokens;
		this.passwordEncoder = passwordEncoder;
		this.emailService = emailService;
		this.mailProps = mailProps;
		this.clock = clock;
	}

	/**
	 * Gửi link đặt lại mật khẩu nếu tài khoản tồn tại và đang hoạt động. Luôn kết thúc bình thường để không lộ
	 * email/số điện thoại nào có trong hệ thống.
	 */
	@Transactional
	public void requestReset(String identifier) {
		Optional<User> found = authService.findByIdentifier(identifier).filter(User::isActive);
		if (found.isEmpty()) {
			return;
		}
		User user = found.get();
		Instant now = clock.instant();
		if (resetTokens.existsByUserIdAndCreatedAtAfter(user.getId(), now.minus(REQUEST_COOLDOWN))) {
			log.info("Bỏ qua yêu cầu đặt lại mật khẩu lặp lại của user {}", user.getId());
			return;
		}
		String link = issueLink(user, TOKEN_TTL, now);
		emailService.send(user.getEmail(), "Đặt lại mật khẩu", textBody(user, link), htmlBody(user, link));
	}

	/**
	 * Tài khoản mới do hiệu trưởng tạo: gửi email mời tự đặt mật khẩu (link {@link #INVITE_TTL}, dùng một
	 * lần). Người tạo không bao giờ biết mật khẩu của nhân viên.
	 */
	@Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
	public void sendInvite(User user) {
		String link = issueLink(user, INVITE_TTL, clock.instant());
		String text = """
				Xin chào %s,

				Nhà trường đã tạo tài khoản Preschool Management cho bạn (đăng nhập bằng email %s).
				Mở link sau để tự đặt mật khẩu (hiệu lực %d ngày, dùng một lần):

				%s
				""".formatted(user.getFullName(), user.getEmail(), INVITE_TTL.toDays(), link);
		String html = """
				<p>Xin chào %s,</p>
				<p>Nhà trường đã tạo tài khoản Preschool Management cho bạn (đăng nhập bằng email <b>%s</b>).</p>
				<p><a href="%s" style="display:inline-block;padding:10px 18px;background:#166534;color:#fff;\
				text-decoration:none;border-radius:6px">Đặt mật khẩu</a></p>
				<p>Link có hiệu lực %d ngày và chỉ dùng được một lần.</p>
				""".formatted(HtmlUtils.htmlEscape(user.getFullName()), HtmlUtils.htmlEscape(user.getEmail()),
				HtmlUtils.htmlEscape(link), INVITE_TTL.toDays());
		emailService.send(user.getEmail(), "Tài khoản Preschool Management của bạn", text, html);
	}

	/** Tạo link đặt mật khẩu mới (vô hiệu link cũ chưa dùng). */
	private String issueLink(User user, Duration ttl, Instant now) {
		resetTokens.invalidateAll(user.getId(), now);
		String rawToken = SecureTokens.newRawToken();
		resetTokens.save(new PasswordResetToken(user, SecureTokens.hash(rawToken), now.plus(ttl)));
		return UriComponentsBuilder.fromUri(mailProps.frontendUrl())
			.path("/reset-password")
			.queryParam("token", rawToken)
			.build()
			.toUriString();
	}

	/** Đặt mật khẩu mới bằng link trong email; thành công thì đăng xuất mọi phiên của tài khoản. */
	@Transactional
	public void resetPassword(String rawToken, String newPassword) {
		Instant now = clock.instant();
		PasswordResetToken token = resetTokens.findByTokenHash(SecureTokens.hash(rawToken))
			.filter(t -> t.isUsable(now))
			.filter(t -> t.getUser().isActive())
			.orElseThrow(() -> ApiException.badRequest("RESET_TOKEN_INVALID",
					"Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu link mới."));
		validatePassword(newPassword);

		User user = token.getUser();
		user.changePassword(passwordEncoder.encode(newPassword));
		token.markUsed(now);
		resetTokens.invalidateAll(user.getId(), now);
		refreshTokens.revokeAllForUser(user.getId(), now);
	}

	static void validatePassword(String password) {
		boolean hasLetter = password.chars().anyMatch(Character::isLetter);
		boolean hasDigit = password.chars().anyMatch(Character::isDigit);
		if (password.length() < 8 || !hasLetter || !hasDigit) {
			throw ApiException.badRequest("PASSWORD_TOO_WEAK", "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số.");
		}
		if (password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
			throw ApiException.badRequest("PASSWORD_TOO_LONG", "Mật khẩu quá dài.");
		}
	}

	private static String textBody(User user, String link) {
		return """
				Xin chào %s,

				Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
				Mở link sau để đặt mật khẩu mới (hiệu lực %d phút, dùng một lần):

				%s

				Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.
				""".formatted(user.getFullName(), TOKEN_TTL.toMinutes(), link);
	}

	private static String htmlBody(User user, String link) {
		String safeLink = HtmlUtils.htmlEscape(link);
		return """
				<p>Xin chào %s,</p>
				<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
				<p><a href="%s" style="display:inline-block;padding:10px 18px;background:#166534;color:#fff;\
				text-decoration:none;border-radius:6px">Đặt mật khẩu mới</a></p>
				<p>Link có hiệu lực %d phút và chỉ dùng được một lần.</p>
				<p style="color:#666">Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.</p>
				""".formatted(HtmlUtils.htmlEscape(user.getFullName()), safeLink, TOKEN_TTL.toMinutes());
	}

}
