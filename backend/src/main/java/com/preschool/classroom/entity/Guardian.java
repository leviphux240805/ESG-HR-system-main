package com.preschool.classroom.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Phụ huynh hoặc người thân của trẻ. {@code userId} chừa sẵn cho cổng phụ huynh (ngoài phạm vi bản đầu). */
@Entity
@Table(name = "guardians")
@Filter(name = SchoolFilter.NAME)
public class Guardian extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "full_name", nullable = false)
	private String fullName;

	private String phone;

	private String email;

	@Column(name = "citizen_id")
	private String citizenId;

	private String job;

	@Column(name = "user_id")
	private UUID userId;

	protected Guardian() {
	}

	public Guardian(UUID schoolId, String fullName, String phone, String email, String citizenId, String job) {
		this.schoolId = schoolId;
		this.fullName = fullName;
		this.phone = phone;
		this.email = email;
		this.citizenId = citizenId;
		this.job = job;
	}

	public void update(String fullName, String phone, String email, String citizenId, String job) {
		this.fullName = fullName;
		this.phone = phone;
		this.email = email;
		this.citizenId = citizenId;
		this.job = job;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public String getFullName() {
		return fullName;
	}

	public String getPhone() {
		return phone;
	}

	public String getEmail() {
		return email;
	}

	public String getCitizenId() {
		return citizenId;
	}

	public String getJob() {
		return job;
	}

	public UUID getUserId() {
		return userId;
	}

}
