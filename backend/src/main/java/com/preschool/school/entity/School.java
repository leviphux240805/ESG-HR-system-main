package com.preschool.school.entity;

import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "schools")
@Filter(name = OrganizationFilter.NAME)
public class School extends OrganizationEntity {

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

	/** Tạo ngoài request (seed, test, bên vận hành): gán tổ chức trực tiếp. */
	public School(java.util.UUID organizationId, String code, String name) {
		this(code, name);
		assignOrganization(organizationId);
	}

	public void update(String code, String name, String provinceCode, String wardCode, String addressDetail,
			String phone, String licenseNo) {
		this.code = code;
		this.name = name;
		this.provinceCode = provinceCode;
		this.wardCode = wardCode;
		this.addressDetail = addressDetail;
		this.phone = phone;
		this.licenseNo = licenseNo;
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
