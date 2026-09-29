package com.preschool.common.mail;

import java.net.URI;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cấu hình email ({@code app.mail.*}). Máy chủ SMTP cấu hình qua {@code spring.mail.*}.
 *
 * @param from địa chỉ người gửi
 * @param frontendUrl địa chỉ web app, dùng để dựng link trong email
 */
@ConfigurationProperties("app.mail")
public record MailProperties(
		@DefaultValue("Preschool Management <no-reply@preschool.local>") String from,
		@DefaultValue("http://localhost:8080") URI frontendUrl) {
}
