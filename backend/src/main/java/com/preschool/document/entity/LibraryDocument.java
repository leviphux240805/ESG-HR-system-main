package com.preschool.document.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.common.jpa.OrganizationEntity;
import com.preschool.common.jpa.OrganizationFilter;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Văn bản trong thư viện. Phạm vi xem = {@code schoolId} (rỗng = cả tổ chức) + {@code visibleRoles} (rỗng = mọi vai
 * trò). Khi {@code requireAck}, người đọc phải xác nhận phiên bản {@code ackVersionNo} (hoặc mới hơn).
 */
@Entity
@Table(name = "library_documents")
@Filter(name = OrganizationFilter.NAME)
@Filter(name = SchoolFilter.NAME)
public class LibraryDocument extends OrganizationEntity {

	@Column(name = "school_id")
	private UUID schoolId;

	@Column(name = "folder_id")
	private UUID folderId;

	@Column(nullable = false)
	private String title;

	@Column(name = "doc_number")
	private String docNumber;

	@Column(name = "issued_date")
	private LocalDate issuedDate;

	@Column(name = "effective_to")
	private LocalDate effectiveTo;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "visible_roles", nullable = false, columnDefinition = "varchar(20)[]")
	private String[] visibleRoles = new String[0];

	@Column(name = "require_ack", nullable = false)
	private boolean requireAck;

	@Column(name = "ack_version_no")
	private Integer ackVersionNo;

	@Column(name = "current_version_no", nullable = false)
	private int currentVersionNo = 1;

	@Column(name = "last_reminded_at")
	private Instant lastRemindedAt;

	protected LibraryDocument() {
	}

	public LibraryDocument(UUID schoolId) {
		this.schoolId = schoolId;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getFolderId() {
		return folderId;
	}

	public void setFolderId(UUID folderId) {
		this.folderId = folderId;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getDocNumber() {
		return docNumber;
	}

	public void setDocNumber(String docNumber) {
		this.docNumber = docNumber;
	}

	public LocalDate getIssuedDate() {
		return issuedDate;
	}

	public void setIssuedDate(LocalDate issuedDate) {
		this.issuedDate = issuedDate;
	}

	public LocalDate getEffectiveTo() {
		return effectiveTo;
	}

	public void setEffectiveTo(LocalDate effectiveTo) {
		this.effectiveTo = effectiveTo;
	}

	public List<RoleCode> getVisibleRoles() {
		return java.util.Arrays.stream(visibleRoles).map(RoleCode::valueOf).toList();
	}

	public void setVisibleRoles(List<RoleCode> roles) {
		this.visibleRoles = roles == null ? new String[0]
				: roles.stream().distinct().sorted().map(RoleCode::name).toArray(String[]::new);
	}

	public boolean isRequireAck() {
		return requireAck;
	}

	public Integer getAckVersionNo() {
		return ackVersionNo;
	}

	/** Bật/tắt yêu cầu xác nhận; bật lại thì yêu cầu xác nhận phiên bản hiện tại. */
	public void setRequireAck(boolean requireAck) {
		if (requireAck && !this.requireAck) {
			this.ackVersionNo = currentVersionNo;
		}
		this.requireAck = requireAck;
		if (!requireAck) {
			this.ackVersionNo = null;
		}
	}

	public int getCurrentVersionNo() {
		return currentVersionNo;
	}

	/** Thêm phiên bản mới; {@code reack} = người đọc phải xác nhận lại phiên bản này. */
	public int nextVersion(boolean reack) {
		currentVersionNo++;
		if (requireAck && reack) {
			ackVersionNo = currentVersionNo;
		}
		return currentVersionNo;
	}

	public Instant getLastRemindedAt() {
		return lastRemindedAt;
	}

	public void setLastRemindedAt(Instant lastRemindedAt) {
		this.lastRemindedAt = lastRemindedAt;
	}

}
