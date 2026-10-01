package com.preschool.common.mail;

import java.nio.charset.StandardCharsets;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Gửi email qua SMTP. Chạy bất đồng bộ: request không phải chờ SMTP, và thời gian phản hồi không để lộ việc
 * email có được gửi hay không. Lỗi SMTP chỉ ghi log.
 */
@Service
@EnableConfigurationProperties(MailProperties.class)
public class EmailService {

	private static final Logger log = LoggerFactory.getLogger(EmailService.class);

	private final JavaMailSender mailSender;

	private final MailProperties props;

	public EmailService(JavaMailSender mailSender, MailProperties props) {
		this.mailSender = mailSender;
		this.props = props;
	}

	/** Tài khoản không có email (đăng nhập bằng số điện thoại) thì bỏ qua. */
	@Async
	public void send(String to, String subject, String textBody, String htmlBody) {
		if (to == null || to.isBlank()) {
			return;
		}
		try {
			MimeMessage message = mailSender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
			helper.setFrom(props.from());
			helper.setTo(to);
			helper.setSubject(subject);
			helper.setText(textBody, htmlBody);
			mailSender.send(message);
		}
		catch (MessagingException | MailException ex) {
			log.error("Không gửi được email \"{}\" tới {}: {}", subject, to, ex.getMessage());
		}
	}

}
