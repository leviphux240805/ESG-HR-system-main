package com.preschool.notification.service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import com.preschool.common.error.ApiException;
import com.preschool.common.web.PageResponse;
import com.preschool.notification.entity.Notification;
import com.preschool.notification.repository.NotificationRepository;
import com.preschool.security.SchoolScope;

import io.swagger.v3.oas.annotations.media.Schema;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Thông báo trong app: mỗi người chỉ thấy thông báo của mình. */
@Service
public class NotificationService {

	private final NotificationRepository notifications;

	private final Clock clock;

	public NotificationService(NotificationRepository notifications, Clock clock) {
		this.notifications = notifications;
		this.clock = clock;
	}

	public record NotificationDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			String body,
			@Schema(description = "Đường dẫn trong app để mở khi bấm") String link,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			Instant readAt) {
	}

	/**
	 * Tạo thông báo; có `dedupeKey` thì bỏ qua nếu người nhận đã có thông báo cùng khóa (job chạy lại không trùng).
	 * Trả true nếu thực sự tạo mới.
	 */
	@Transactional
	public boolean notify(UUID userId, String type, String title, String body, String link, String dedupeKey) {
		if (dedupeKey != null && notifications.existsByUserIdAndDedupeKey(userId, dedupeKey)) {
			return false;
		}
		notifications.save(new Notification(userId, type, title, body, link).withDedupeKey(dedupeKey));
		return true;
	}

	@Transactional(readOnly = true)
	public PageResponse<NotificationDto> mine(Pageable pageable) {
		Pageable page = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 50));
		return PageResponse.of(notifications.findByUserIdOrderByCreatedAtDesc(me(), page), NotificationService::toDto);
	}

	@Transactional(readOnly = true)
	public long unreadCount() {
		return notifications.countByUserIdAndReadAtIsNull(me());
	}

	@Transactional
	public NotificationDto markRead(UUID id) {
		Notification n = notifications.findByIdAndUserId(id, me())
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy thông báo."));
		n.markRead(clock.instant());
		return toDto(n);
	}

	@Transactional
	public int markAllRead() {
		return notifications.markAllRead(me(), clock.instant());
	}

	private static UUID me() {
		return SchoolScope.require().userId();
	}

	private static NotificationDto toDto(Notification n) {
		return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLink(), n.getCreatedAt(),
				n.getReadAt());
	}

}
