package com.preschool.classroom.entity;

import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Lớp của một cơ sở trong một năm học ({@code class} là từ khóa Java nên entity đặt tên SchoolClass). */
@Entity
@Table(name = "classes")
@Filter(name = SchoolFilter.NAME)
public class SchoolClass extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "school_year_id", nullable = false)
	private UUID schoolYearId;

	@Column(name = "age_group_id", nullable = false)
	private UUID ageGroupId;

	@Column(nullable = false)
	private String name;

	private String room;

	@Column(nullable = false)
	private int capacity;

	private String note;

	@Column(nullable = false)
	private boolean archived = false;

	protected SchoolClass() {
	}

	public SchoolClass(UUID schoolId, UUID schoolYearId, UUID ageGroupId, String name, String room, int capacity,
			String note) {
		this.schoolId = schoolId;
		this.schoolYearId = schoolYearId;
		this.ageGroupId = ageGroupId;
		this.name = name;
		this.room = room;
		this.capacity = capacity;
		this.note = note;
		this.archived = false;
	}

	public void update(UUID ageGroupId, String name, String room, int capacity, String note) {
		this.ageGroupId = ageGroupId;
		this.name = name;
		this.room = room;
		this.capacity = capacity;
		this.note = note;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getSchoolYearId() {
		return schoolYearId;
	}

	public UUID getAgeGroupId() {
		return ageGroupId;
	}

	public String getName() {
		return name;
	}

	public String getRoom() {
		return room;
	}

	public int getCapacity() {
		return capacity;
	}

	public String getNote() {
		return note;
	}

	public boolean isArchived() {
		return archived;
	}

	public void setArchived(boolean archived) {
		this.archived = archived;
	}

}
