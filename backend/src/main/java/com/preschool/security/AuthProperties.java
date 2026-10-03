package com.preschool.security;

import java.time.Duration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Cấu hình xác thực ({@code app.auth.*}).
 *
 * @param jwtSecret khóa ký HS256, tối thiểu 32 ký tự; bắt buộc đặt qua biến môi trường JWT_SECRET ngoài dev
 * @param accessTokenTtl thời hạn access token (mặc định 15 phút)
 * @param refreshTokenTtl thời hạn refresh token (mặc định 7 ngày)
 * @param refreshCookieSecure bật cờ Secure (bắt buộc khi chạy HTTPS)
 * @param refreshReuseGrace khoảng thời gian coi việc dùng lại token vừa xoay là do hai tab refresh cùng lúc
 * @param loginMaxAttempts số lần đăng nhập sai tối đa của một tài khoản trong {@code loginWindow}
 * @param loginMaxAttemptsPerIp số lần sai tối đa từ một địa chỉ IP trong {@code loginWindow}
 * @param loginWindow cửa sổ đếm lần sai (cũng là thời gian bị chặn tối đa)
 */
@Validated
@ConfigurationProperties("app.auth")
public record AuthProperties(
		@NotBlank @Size(min = 32, message = "JWT_SECRET phải dài ít nhất 32 ký tự") String jwtSecret,
		@DefaultValue("15m") Duration accessTokenTtl,
		@DefaultValue("7d") Duration refreshTokenTtl,
		@DefaultValue("true") boolean refreshCookieSecure,
		@DefaultValue("10s") Duration refreshReuseGrace,
		@DefaultValue("5") int loginMaxAttempts,
		@DefaultValue("30") int loginMaxAttemptsPerIp,
		@DefaultValue("15m") Duration loginWindow) {

	/** Tên cookie httpOnly chứa refresh token. */
	public static final String REFRESH_COOKIE_NAME = "refresh_token";

	/** Cookie refresh chỉ được trình duyệt gửi tới các endpoint xác thực. */
	public static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

}
