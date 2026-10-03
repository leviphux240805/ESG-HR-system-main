package com.preschool.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import com.preschool.common.error.ApiException;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

class LoginRateLimiterTests {

	static final AuthProperties PROPS = new AuthProperties("x".repeat(32), Duration.ofMinutes(15), Duration.ofDays(7),
			false, Duration.ofSeconds(10), 3, 5, Duration.ofMinutes(15));

	static class MutableClock extends Clock {

		Instant now = Instant.parse("2026-10-03T08:00:00Z");

		@Override
		public java.time.ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}

	}

	final MutableClock clock = new MutableClock();

	final LoginRateLimiter limiter = new LoginRateLimiter(PROPS, clock);

	@Test
	void blocksAccountAfterMaxFailuresUntilWindowPasses() {
		for (int i = 0; i < 3; i++) {
			limiter.check("Co.Giao@Truong.vn", "1.1.1.1");
			limiter.failed("co.giao@truong.vn ", "1.1.1.1");
		}
		assertThatThrownBy(() -> limiter.check("co.giao@truong.vn", "2.2.2.2")).isInstanceOfSatisfying(ApiException.class,
				ex -> {
					assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
					assertThat(ex.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("900");
					assertThat(ex.getBody().getDetail()).isEqualTo("Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.");
				});

		clock.now = clock.now.plus(Duration.ofMinutes(15));
		assertThatCode(() -> limiter.check("co.giao@truong.vn", "1.1.1.1")).doesNotThrowAnyException();
	}

	@Test
	void successResetsAccountCounter() {
		limiter.failed("a@b.vn", "1.1.1.1");
		limiter.failed("a@b.vn", "1.1.1.1");
		limiter.succeeded("a@b.vn");
		limiter.failed("a@b.vn", "1.1.1.1");
		assertThatCode(() -> limiter.check("a@b.vn", "3.3.3.3")).doesNotThrowAnyException();
	}

	@Test
	void blocksIpTryingManyAccounts() {
		for (int i = 0; i < 5; i++) {
			limiter.failed("user" + i + "@b.vn", "9.9.9.9");
		}
		assertThatThrownBy(() -> limiter.check("khac@b.vn", "9.9.9.9")).isInstanceOf(ApiException.class);
		assertThatCode(() -> limiter.check("khac@b.vn", "8.8.8.8")).doesNotThrowAnyException();
	}

	@Test
	void clientIpUsesFirstForwardedAddress() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("10.0.0.1");
		assertThat(LoginRateLimiter.clientIp(request)).isEqualTo("10.0.0.1");
		request.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.1");
		assertThat(LoginRateLimiter.clientIp(request)).isEqualTo("203.0.113.5");
	}

}
