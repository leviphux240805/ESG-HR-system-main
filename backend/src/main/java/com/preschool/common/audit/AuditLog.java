package com.preschool.common.audit;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Nhật ký thao tác: ai sửa gì, lúc nào (created_at). Dữ liệu trước/sau lưu JSON. */
@Entity
@Table(name = "audit_logs")
public class AuditLog extends BaseEntity {

	public enum Action {
		CREATE, UPDATE, DELETE
	}

	@Column(name = "user_id")
	private UUID userId;

	@Column(nullable = false)
	private String entity;

	@Column(name = "entity_id", nullable = false)
	private UUID entityId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Action action;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "before_data")
	private String beforeData;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "after_data")
	private String afterData;

	protected AuditLog() {
	}

	public AuditLog(UUID userId, String entity, UUID entityId, Action action, String beforeData, String afterData) {
		this.userId = userId;
		this.entity = entity;
		this.entityId = entityId;
		this.action = action;
		this.beforeData = beforeData;
		this.afterData = afterData;
	}

	public UUID getUserId() {
		return userId;
	}

	public String getEntity() {
		return entity;
	}

	public UUID getEntityId() {
		return entityId;
	}

	public Action getAction() {
		return action;
	}

	public String getBeforeData() {
		return beforeData;
	}

	public String getAfterData() {
		return afterData;
	}

}
