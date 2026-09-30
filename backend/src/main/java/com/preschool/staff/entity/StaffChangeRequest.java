package com.preschool.staff.entity;

import java.time.Instant;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.staff.entity.StaffEnums.ChangeRequestStatus;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Nhân viên tự đề xuất cập nhật thông tin; chỉ áp vào hồ sơ sau khi được duyệt. */
@Entity
@Table(name = "staff_change_requests")
@Filter(name = SchoolFilter.NAME)
public class StaffChangeRequest extends BaseEntity {

	@Column(name = "staff_id", nullable = false)
	private UUID staffId;

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	/** JSON các trường đề xuất đổi, ví dụ {"phone": "0912…", "bankAccountNo": "…"}. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private String changes;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private ChangeRequestStatus status = ChangeRequestStatus.PENDING;

	@Column(name = "reviewed_by")
	private UUID reviewedBy;

	@Column(name = "reviewed_at")
	private Instant reviewedAt;

	@Column(name = "review_note")
	private String reviewNote;

	protected StaffChangeRequest() {
	}

	public StaffChangeRequest(UUID staffId, UUID schoolId, String changes) {
		this.staffId = staffId;
		this.schoolId = schoolId;
		this.changes = changes;
	}

	public void review(ChangeRequestStatus status, UUID reviewer, Instant at, String note) {
		this.status = status;
		this.reviewedBy = reviewer;
		this.reviewedAt = at;
		this.reviewNote = note;
	}

	public UUID getStaffId() {
		return staffId;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public String getChanges() {
		return changes;
	}

	public ChangeRequestStatus getStatus() {
		return status;
	}

	public UUID getReviewedBy() {
		return reviewedBy;
	}

	public Instant getReviewedAt() {
		return reviewedAt;
	}

	public String getReviewNote() {
		return reviewNote;
	}

}
