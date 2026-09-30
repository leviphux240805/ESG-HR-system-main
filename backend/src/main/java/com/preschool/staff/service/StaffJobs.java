package com.preschool.staff.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

import com.preschool.common.jobs.SchedulingConfig;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Job nền của module nhân sự. */
@Component
public class StaffJobs {

	private static final Logger log = LoggerFactory.getLogger(StaffJobs.class);

	private final StaffLifecycleService lifecycle;

	private final Clock clock;

	private final StaffExpiryNotifier expiryNotifier;

	public StaffJobs(StaffLifecycleService lifecycle, StaffExpiryNotifier expiryNotifier, Clock clock) {
		this.lifecycle = lifecycle;
		this.expiryNotifier = expiryNotifier;
		this.clock = clock;
	}

	/** 07:00 hằng ngày: thông báo giấy tờ hết hạn trong 30 ngày cho văn phòng điều hành và hiệu trưởng. */
	@Scheduled(cron = "0 0 7 * * *", zone = SchedulingConfig.ZONE)
	public void notifyExpiringDocuments() {
		int created = expiryNotifier.run(LocalDate.now(clock.withZone(ZoneId.of(SchedulingConfig.ZONE))));
		log.info("Đã tạo {} thông báo giấy tờ sắp hết hạn", created);
	}

	/** 00:05 hằng ngày: chuyển nhân viên sang cơ sở mới khi điều chuyển tới ngày hiệu lực. */
	@Scheduled(cron = "0 5 0 * * *", zone = SchedulingConfig.ZONE)
	public void applyDueTransfers() {
		int applied = lifecycle.applyDueTransfers(LocalDate.now(clock.withZone(ZoneId.of(SchedulingConfig.ZONE))));
		if (applied > 0) {
			log.info("Đã áp dụng {} điều chuyển tới ngày hiệu lực", applied);
		}
	}

}
