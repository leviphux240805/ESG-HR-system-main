package com.preschool.document.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

/** Thư mục của thư viện văn bản; {@code schoolId} rỗng = thư mục dùng chung toàn chuỗi. */
@Entity
@Table(name = "doc_folders")
@Filter(name = SchoolFilter.NAME)
public class DocFolder extends BaseEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "parent_id")
	private UUID parentId;

	@Column(nullable = false)
	private String name;

	protected DocFolder() {
	}

	public DocFolder(UUID schoolId, UUID parentId, String name) {
		this.schoolId = schoolId;
		this.parentId = parentId;
		this.name = name;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getParentId() {
		return parentId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

}
