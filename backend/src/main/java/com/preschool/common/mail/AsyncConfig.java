package com.preschool.common.mail;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** Bật {@code @Async} (gửi email không chặn request). */
@Configuration
@EnableAsync
public class AsyncConfig {

}
