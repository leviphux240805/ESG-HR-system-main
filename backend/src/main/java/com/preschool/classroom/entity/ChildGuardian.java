package com.preschool.classroom.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Quan hệ trẻ với phụ huynh: ai là người liên hệ chính, ai được phép đón trẻ. */
@Entity
@Table(name = "child_guardians")
@Filter(name = SchoolFilter.NAME)
public class ChildGuardian extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "child_id", nullable = false)
	private UUID childId;

	@Column(name = "guardian_id", nullable = false)
	private UUID guardianId;

	@Column(nullable = false)
	private String relationship;

	@Column(name = "is_primary", nullable = false)
	private boolean primaryContact;

	@Column(name = "can_pick_up", nullable = false)
	private boolean canPickUp = true;

	private String note;

	protected ChildGuardian() {
	}

	public ChildGuardian(UUID schoolId, UUID childId, UUID guardianId, String relationship, boolean primaryContact,
			boolean canPickUp, String note) {
		this.schoolId = schoolId;
		this.childId = childId;
		this.guardianId = guardianId;
		this.relationship = relationship;
		this.primaryContact = primaryContact;
		this.canPickUp = canPickUp;
		this.note = note;
	}

	public void update(String relationship, boolean primaryContact, boolean canPickUp, String note) {
		this.relationship = relationship;
		this.primaryContact = primaryContact;
		this.canPickUp = canPickUp;
		this.note = note;
	}

	public void clearPrimary() {
		this.primaryContact = false;
	}

	public UUID getChildId() {
		return childId;
	}

	public UUID getGuardianId() {
		return guardianId;
	}

	public String getRelationship() {
		return relationship;
	}

	public boolean isPrimaryContact() {
		return primaryContact;
	}

	public boolean isCanPickUp() {
		return canPickUp;
	}

	public String getNote() {
		return note;
	}

}
