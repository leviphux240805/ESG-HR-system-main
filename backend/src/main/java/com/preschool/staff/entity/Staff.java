package com.preschool.staff.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.staff.entity.StaffEnums.Gender;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.entity.StaffEnums.Qualification;
import com.preschool.staff.entity.StaffEnums.StaffStatus;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Hồ sơ nhân viên. {@code schoolId} là cơ sở hiện tại (lịch sử ở {@link StaffSchoolAssignment}); lọc theo cơ sở
 * đang chọn bằng Hibernate filter; hồ sơ đã xóa mềm bị ẩn.
 */
@Entity
@Table(name = "staff")
@Filter(name = SchoolFilter.NAME)
@SQLRestriction("deleted_at IS NULL")
public class Staff extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	/** Mã nhân viên do DB sinh (NV0001…). */
	@Generated(event = EventType.INSERT)
	@Column(name = "staff_code", nullable = false, insertable = false, updatable = false)
	private String staffCode;

	@Column(name = "full_name", nullable = false)
	private String fullName;

	private LocalDate dob;

	@Enumerated(EnumType.STRING)
	private Gender gender;

	private String ethnicity;

	@Column(name = "citizen_id")
	private String citizenId;

	@Column(name = "citizen_id_issued_on")
	private LocalDate citizenIdIssuedOn;

	private String phone;

	private String email;

	@Column(name = "perm_province_code")
	private String permProvinceCode;

	@Column(name = "perm_ward_code")
	private String permWardCode;

	@Column(name = "perm_address_detail")
	private String permAddressDetail;

	@Column(name = "curr_province_code")
	private String currProvinceCode;

	@Column(name = "curr_ward_code")
	private String currWardCode;

	@Column(name = "curr_address_detail")
	private String currAddressDetail;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Position position;

	@Enumerated(EnumType.STRING)
	private Qualification qualification;

	private String specialization;

	/** Mã nhân viên trên máy chấm công của cơ sở (khớp file Excel khi import). */
	@Column(name = "machine_code")
	private String machineCode;

	@Column(name = "bank_name")
	private String bankName;

	@Column(name = "bank_account_no")
	private String bankAccountNo;

	@Column(name = "bank_account_holder")
	private String bankAccountHolder;

	@Column(name = "social_insurance_no")
	private String socialInsuranceNo;

	@Column(name = "health_insurance_no")
	private String healthInsuranceNo;

	@Column(name = "personal_tax_code")
	private String personalTaxCode;

	@Column(name = "photo_file_id")
	private UUID photoFileId;

	@Column(name = "start_date", nullable = false)
	private LocalDate startDate;

	@Column(name = "end_date")
	private LocalDate endDate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private StaffStatus status = StaffStatus.ACTIVE;

	@Column(name = "termination_reason")
	private String terminationReason;

	@Column(name = "deleted_at")
	private Instant deletedAt;

	protected Staff() {
	}

	public Staff(UUID schoolId, String fullName, Position position, LocalDate startDate) {
		this.schoolId = schoolId;
		this.fullName = fullName;
		this.position = position;
		this.startDate = startDate;
	}

	public void terminate(LocalDate endDate, String reason) {
		this.status = StaffStatus.TERMINATED;
		this.endDate = endDate;
		this.terminationReason = reason;
	}

	public boolean isActive() {
		return status == StaffStatus.ACTIVE;
	}

	// ------------------------------------------------------------ getters/setters

	public UUID getSchoolId() {
		return schoolId;
	}

	/** Đổi cơ sở (điều chuyển): mã chấm công thuộc máy của cơ sở cũ nên bị bỏ, cơ sở mới gán mã khác. */
	public void setSchoolId(UUID schoolId) {
		if (this.schoolId != null && !this.schoolId.equals(schoolId)) {
			this.machineCode = null;
		}
		this.schoolId = schoolId;
	}

	public String getStaffCode() {
		return staffCode;
	}

	public String getFullName() {
		return fullName;
	}

	public void setFullName(String fullName) {
		this.fullName = fullName;
	}

	public LocalDate getDob() {
		return dob;
	}

	public void setDob(LocalDate dob) {
		this.dob = dob;
	}

	public Gender getGender() {
		return gender;
	}

	public void setGender(Gender gender) {
		this.gender = gender;
	}

	public String getEthnicity() {
		return ethnicity;
	}

	public void setEthnicity(String ethnicity) {
		this.ethnicity = ethnicity;
	}

	public String getCitizenId() {
		return citizenId;
	}

	public void setCitizenId(String citizenId) {
		this.citizenId = citizenId;
	}

	public LocalDate getCitizenIdIssuedOn() {
		return citizenIdIssuedOn;
	}

	public void setCitizenIdIssuedOn(LocalDate citizenIdIssuedOn) {
		this.citizenIdIssuedOn = citizenIdIssuedOn;
	}

	public String getPhone() {
		return phone;
	}

	public void setPhone(String phone) {
		this.phone = phone;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPermProvinceCode() {
		return permProvinceCode;
	}

	public void setPermProvinceCode(String permProvinceCode) {
		this.permProvinceCode = permProvinceCode;
	}

	public String getPermWardCode() {
		return permWardCode;
	}

	public void setPermWardCode(String permWardCode) {
		this.permWardCode = permWardCode;
	}

	public String getPermAddressDetail() {
		return permAddressDetail;
	}

	public void setPermAddressDetail(String permAddressDetail) {
		this.permAddressDetail = permAddressDetail;
	}

	public String getCurrProvinceCode() {
		return currProvinceCode;
	}

	public void setCurrProvinceCode(String currProvinceCode) {
		this.currProvinceCode = currProvinceCode;
	}

	public String getCurrWardCode() {
		return currWardCode;
	}

	public void setCurrWardCode(String currWardCode) {
		this.currWardCode = currWardCode;
	}

	public String getCurrAddressDetail() {
		return currAddressDetail;
	}

	public void setCurrAddressDetail(String currAddressDetail) {
		this.currAddressDetail = currAddressDetail;
	}

	public Position getPosition() {
		return position;
	}

	public void setPosition(Position position) {
		this.position = position;
	}

	public Qualification getQualification() {
		return qualification;
	}

	public void setQualification(Qualification qualification) {
		this.qualification = qualification;
	}

	public String getMachineCode() {
		return machineCode;
	}

	public void setMachineCode(String machineCode) {
		this.machineCode = machineCode;
	}

	public String getSpecialization() {
		return specialization;
	}

	public void setSpecialization(String specialization) {
		this.specialization = specialization;
	}

	public String getBankName() {
		return bankName;
	}

	public void setBankName(String bankName) {
		this.bankName = bankName;
	}

	public String getBankAccountNo() {
		return bankAccountNo;
	}

	public void setBankAccountNo(String bankAccountNo) {
		this.bankAccountNo = bankAccountNo;
	}

	public String getBankAccountHolder() {
		return bankAccountHolder;
	}

	public void setBankAccountHolder(String bankAccountHolder) {
		this.bankAccountHolder = bankAccountHolder;
	}

	public String getSocialInsuranceNo() {
		return socialInsuranceNo;
	}

	public void setSocialInsuranceNo(String socialInsuranceNo) {
		this.socialInsuranceNo = socialInsuranceNo;
	}

	public String getHealthInsuranceNo() {
		return healthInsuranceNo;
	}

	public void setHealthInsuranceNo(String healthInsuranceNo) {
		this.healthInsuranceNo = healthInsuranceNo;
	}

	public String getPersonalTaxCode() {
		return personalTaxCode;
	}

	public void setPersonalTaxCode(String personalTaxCode) {
		this.personalTaxCode = personalTaxCode;
	}

	public UUID getPhotoFileId() {
		return photoFileId;
	}

	public void setPhotoFileId(UUID photoFileId) {
		this.photoFileId = photoFileId;
	}

	public LocalDate getStartDate() {
		return startDate;
	}

	public void setStartDate(LocalDate startDate) {
		this.startDate = startDate;
	}

	public LocalDate getEndDate() {
		return endDate;
	}

	public StaffStatus getStatus() {
		return status;
	}

	public String getTerminationReason() {
		return terminationReason;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

}
