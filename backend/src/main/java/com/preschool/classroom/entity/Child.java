package com.preschool.classroom.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Hồ sơ trẻ. Lọc theo cơ sở đang chọn bằng Hibernate filter; hồ sơ đã xóa mềm bị ẩn. */
@Entity
@Table(name = "children")
@Filter(name = SchoolFilter.NAME)
@SQLRestriction("deleted_at IS NULL")
public class Child extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	/** Mã trẻ do DB sinh (HS00001…). */
	@Generated(event = EventType.INSERT)
	@Column(name = "child_code", nullable = false, insertable = false, updatable = false)
	private String childCode;

	@Column(name = "full_name", nullable = false)
	private String fullName;

	private String nickname;

	@Column(nullable = false)
	private LocalDate dob;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Gender gender;

	@Column(name = "personal_id")
	private String personalId;

	@Column(name = "health_insurance_no")
	private String healthInsuranceNo;

	@Column(name = "province_code")
	private String provinceCode;

	@Column(name = "ward_code")
	private String wardCode;

	@Column(name = "address_detail")
	private String addressDetail;

	@Column(name = "allergy_note")
	private String allergyNote;

	@Column(name = "health_note")
	private String healthNote;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private ChildStatus status = ChildStatus.STUDYING;

	@Column(name = "enrolled_at", nullable = false)
	private LocalDate enrolledAt;

	@Column(name = "left_at")
	private LocalDate leftAt;

	@Column(name = "left_reason")
	private String leftReason;

	@Column(name = "photo_file_id")
	private UUID photoFileId;

	@Column(name = "deleted_at")
	private Instant deletedAt;

	protected Child() {
	}

	public Child(UUID schoolId, LocalDate enrolledAt) {
		this.schoolId = schoolId;
		this.enrolledAt = enrolledAt;
	}

	/** Gán các trường hồ sơ (dùng chung cho tạo mới và sửa). */
	public void setFields(String fullName, String nickname, LocalDate dob, Gender gender, String personalId,
			String healthInsuranceNo, String provinceCode, String wardCode, String addressDetail, String allergyNote,
			String healthNote, UUID photoFileId) {
		this.fullName = fullName;
		this.nickname = nickname;
		this.dob = dob;
		this.gender = gender;
		this.personalId = personalId;
		this.healthInsuranceNo = healthInsuranceNo;
		this.provinceCode = provinceCode;
		this.wardCode = wardCode;
		this.addressDetail = addressDetail;
		this.allergyNote = allergyNote;
		this.healthNote = healthNote;
		this.photoFileId = photoFileId;
	}

	/** Cho nghỉ hoặc bảo lưu; {@code COMPLETED} dùng khi trẻ học xong khối lớn nhất. */
	public void changeStatus(ChildStatus status, LocalDate date, String reason) {
		this.status = status;
		this.leftReason = reason;
		this.leftAt = status == ChildStatus.LEFT || status == ChildStatus.COMPLETED ? date : null;
	}

	public void softDelete(Instant at) {
		this.deletedAt = at;
	}

	/** Trẻ đang đi học: có trong danh sách điểm danh và tính học phí. */
	public boolean isStudying() {
		return status == ChildStatus.STUDYING;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public String getChildCode() {
		return childCode;
	}

	public String getFullName() {
		return fullName;
	}

	public String getNickname() {
		return nickname;
	}

	public LocalDate getDob() {
		return dob;
	}

	public Gender getGender() {
		return gender;
	}

	public String getPersonalId() {
		return personalId;
	}

	public String getHealthInsuranceNo() {
		return healthInsuranceNo;
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

	public String getAllergyNote() {
		return allergyNote;
	}

	public String getHealthNote() {
		return healthNote;
	}

	public ChildStatus getStatus() {
		return status;
	}

	public LocalDate getEnrolledAt() {
		return enrolledAt;
	}

	public LocalDate getLeftAt() {
		return leftAt;
	}

	public String getLeftReason() {
		return leftReason;
	}

	public UUID getPhotoFileId() {
		return photoFileId;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

}
