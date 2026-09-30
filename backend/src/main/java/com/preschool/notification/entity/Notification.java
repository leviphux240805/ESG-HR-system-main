package com.preschool.notification.entity;

import java.time.Instant;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "notifications")
public class Notification extends BaseEntity {

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(nullable = false)
	private String type;

	@Column(nullable = false)
	private String title;

	private String body;

	private String link;

	@Column(name = "read_at")
	private Instant readAt;

	/** Khóa chống trùng cho thông báo do job tạo (ví dụ "expiring:contract:{id}:30"). */
	@Column(name = "dedupe_key")
	private String dedupeKey;

	protected Notification() {
	}

	public Notification withDedupeKey(String key) {
		this.dedupeKey = key;
		return this;
	}

	public String getDedupeKey() {
		return dedupeKey;
	}

	public Notification(UUID userId, String type, String title, String body, String link) {
		this.userId = userId;
		this.type = type;
		this.title = title;
		this.body = body;
		this.link = link;
	}

	public UUID getUserId() {
		return userId;
	}

	public String getType() {
		return type;
	}

	public String getTitle() {
		return title;
	}

	public String getBody() {
		return body;
	}

	public String getLink() {
		return link;
	}

	public Instant getReadAt() {
		return readAt;
	}

	public void markRead(Instant now) {
		if (readAt == null) {
			readAt = now;
		}
	}

}
