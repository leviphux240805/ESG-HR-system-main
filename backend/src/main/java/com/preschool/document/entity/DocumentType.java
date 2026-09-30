package com.preschool.document.entity;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Danh mục loại giấy tờ (dùng chung toàn chuỗi). */
@Entity
@Table(name = "document_types")
public class DocumentType extends BaseEntity {

	public enum Scope {
		STAFF, CHILD, LIBRARY
	}

	/** Nhóm hiển thị; DECISION nằm ở tab "Hợp đồng & quyết định" của hồ sơ nhân viên. */
	public enum Category {
		IDENTITY, DECISION, HEALTH, EDUCATION, INSURANCE, DISCIPLINE, SAFETY, OTHER
	}

	@Column(nullable = false)
	private String code;

	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Scope scope;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Category category;

	@Column(name = "has_expiry", nullable = false)
	private boolean hasExpiry;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	protected DocumentType() {
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public Scope getScope() {
		return scope;
	}

	public Category getCategory() {
		return category;
	}

	public boolean isHasExpiry() {
		return hasExpiry;
	}

	public int getSortOrder() {
		return sortOrder;
	}

	public boolean isActive() {
		return active;
	}

}
