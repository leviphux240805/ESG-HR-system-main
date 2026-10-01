package com.preschool.common.jpa;

import java.util.UUID;

import com.preschool.security.SchoolScope;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;

/**
 * Bảng có {@code organization_id}: dữ liệu dùng chung các trường của một tổ chức hoặc danh mục của tổ chức. Khi lưu
 * mới mà chưa gán tổ chức thì lấy tổ chức của người dùng trong request; ngoài request (job, seed) phải gán sẵn.
 */
@MappedSuperclass
public abstract class OrganizationEntity extends BaseEntity {

	@Column(name = "organization_id", nullable = false, updatable = false)
	private UUID organizationId;

	@PrePersist
	void fillOrganization() {
		if (organizationId == null) {
			organizationId = SchoolScope.current()
				.map(SchoolScope::organizationId)
				.orElseThrow(() -> new IllegalStateException("Chưa xác định tổ chức khi lưu " + getClass().getSimpleName()));
		}
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	/** Gán tổ chức khi tạo ngoài request (seed, job, test); không đổi được tổ chức của bản ghi đã lưu. */
	public void assignOrganization(UUID organizationId) {
		if (getId() != null) {
			throw new IllegalStateException("Không đổi tổ chức của bản ghi đã lưu");
		}
		this.organizationId = organizationId;
	}

}
