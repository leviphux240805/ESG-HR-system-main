package com.preschool.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.preschool.common.error.ApiException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Chặn dò mật khẩu: đếm lần thất bại trong cửa sổ trượt theo tài khoản (email/SĐT) và theo địa chỉ IP, vượt ngưỡng
 * thì trả 429 kèm Retry-After. Lưu trong bộ nhớ (một instance backend); đăng nhập thành công xóa bộ đếm của tài khoản.
 */
@Component
public class LoginRateLimiter {

	/** Giới hạn bộ nhớ: quá số khóa này thì dọn các khóa đã hết hạn. */
	private static final int MAX_KEYS = 10_000;

	private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

	private final AuthProperties props;

	private final Clock clock;

	public LoginRateLimiter(AuthProperties props, Clock clock) {
		this.props = props;
		this.clock = clock;
	}

	/** Địa chỉ người dùng: IP đầu tiên trong X-Forwarded-For (sau proxy của Render/Vercel), không có thì IP kết nối. */
	public static String clientIp(HttpServletRequest request) {
		String forwarded = request.getHeader("X-Forwarded-For");
		if (forwarded != null && !forwarded.isBlank()) {
			return forwarded.split(",")[0].strip();
		}
		return request.getRemoteAddr();
	}

	public void check(String identifier, String ip) {
		Instant now = clock.instant();
		Instant until = blockedUntil(accountKey(identifier), props.loginMaxAttempts(), now);
		Instant ipUntil = blockedUntil("ip:" + ip, props.loginMaxAttemptsPerIp(), now);
		if (ipUntil != null && (until == null || ipUntil.isAfter(until))) {
			until = ipUntil;
		}
		if (until != null) {
			long seconds = Math.max(1, Duration.between(now, until).toSeconds());
			ApiException ex = new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
					"Bạn đã thử quá nhiều lần. Vui lòng thử lại sau %d phút.".formatted((seconds + 59) / 60));
			ex.getHeaders().set(HttpHeaders.RETRY_AFTER, String.valueOf(seconds));
			throw ex;
		}
	}

	public void failed(String identifier, String ip) {
		Instant now = clock.instant();
		if (failures.size() > MAX_KEYS) {
			failures.entrySet().removeIf(e -> prune(e.getValue(), now).isEmpty());
		}
		record(accountKey(identifier), now);
		record("ip:" + ip, now);
	}

	public void succeeded(String identifier) {
		failures.remove(accountKey(identifier));
	}

	private void record(String key, Instant now) {
		Deque<Instant> times = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
		synchronized (times) {
			prune(times, now).addLast(now);
		}
	}

	private Instant blockedUntil(String key, int max, Instant now) {
		Deque<Instant> times = failures.get(key);
		if (times == null) {
			return null;
		}
		synchronized (times) {
			prune(times, now);
			return times.size() >= max ? times.peekFirst().plus(props.loginWindow()) : null;
		}
	}

	private Deque<Instant> prune(Deque<Instant> times, Instant now) {
		Instant from = now.minus(props.loginWindow());
		while (!times.isEmpty() && !times.peekFirst().isAfter(from)) {
			times.pollFirst();
		}
		return times;
	}

	private static String accountKey(String identifier) {
		return "id:" + (identifier == null ? "" : identifier.strip().toLowerCase(Locale.ROOT));
	}

}
