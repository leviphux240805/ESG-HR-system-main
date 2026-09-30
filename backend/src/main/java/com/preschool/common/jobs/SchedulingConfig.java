package com.preschool.common.jobs;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Bật job nền {@code @Scheduled} (giờ Việt Nam). Tắt được bằng {@code app.jobs.enabled=false} (test tắt để job không
 * chạy xen giữa). Chạy nhiều instance thì cần ShedLock (xem docs/thiet-ke.md).
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {

	public static final String ZONE = "Asia/Ho_Chi_Minh";

}
