package com.preschool.school.entity;

import com.preschool.common.jpa.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "schools")
public class School extends BaseEntity {

	@Column(nullable = false)
	private String code;

	@Column(nullable = false)
	private String name;

	@Column(name = "province_code")
	private String provinceCode;

	@Column(name = "ward_code")
	private String wardCode;

	@Column(name = "address_detail")
	private String addressDetail;

	private String phone;

	@Column(name = "license_no")
	private String licenseNo;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	protected School() {
	}

	public School(String code, String name) {
		this.code = code;
		this.name = name;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public String getProvinceCode() {
		return provinceCode;
	}

	public String getWardCode() {
		return wardCode;
	}

	public String getAddressDetail() {
		return addressDetail;
	}

	public String getPhone() {
		return phone;
	}

	public String getLicenseNo() {
		return licenseNo;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

}
