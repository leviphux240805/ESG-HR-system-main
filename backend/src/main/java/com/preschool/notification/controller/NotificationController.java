package com.preschool.notification.controller;

import java.util.Map;
import java.util.UUID;

import com.preschool.common.web.PageResponse;
import com.preschool.notification.service.NotificationService;
import com.preschool.notification.service.NotificationService.NotificationDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Thông báo")
public class NotificationController {

	private final NotificationService notifications;

	public NotificationController(NotificationService notifications) {
		this.notifications = notifications;
	}

	@GetMapping
	@Operation(summary = "Thông báo của tôi (mới nhất trước)")
	public PageResponse<NotificationDto> mine(@ParameterObject Pageable pageable) {
		return notifications.mine(pageable);
	}

	@GetMapping("/unread-count")
	public Map<String, Long> unreadCount() {
		return Map.of("count", notifications.unreadCount());
	}

	@PostMapping("/{id}/read")
	public NotificationDto markRead(@PathVariable UUID id) {
		return notifications.markRead(id);
	}

	@PostMapping("/read-all")
	public Map<String, Integer> markAllRead() {
		return Map.of("updated", notifications.markAllRead());
	}

}
