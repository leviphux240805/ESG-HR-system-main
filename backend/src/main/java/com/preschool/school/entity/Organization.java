package com.preschool.school.entity;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Tổ chức (khách hàng): sở hữu các trường và dữ liệu dùng chung giữa các trường. Bên vận hành tạo. */
@Entity
@Table(name = "organizations")
public class Organization extends BaseEntity {

	@Column(nullable = false)
	private String name;

	protected Organization() {
	}

	public String getName() {
		return name;
	}

}
