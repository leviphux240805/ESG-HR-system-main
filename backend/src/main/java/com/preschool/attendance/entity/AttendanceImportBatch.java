package com.preschool.attendance.entity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Một lần import file máy chấm công của cơ sở cho một tháng. */
@Entity
@Table(name = "attendance_import_batches")
@Filter(name = SchoolFilter.NAME)
@Immutable
public class AttendanceImportBatch extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(nullable = false)
	private LocalDate month;

	@Column(name = "file_id")
	private UUID fileId;

	@Column(name = "row_count", nullable = false)
	private int rowCount;

	@Column(name = "matched_count", nullable = false)
	private int matchedCount;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "unmatched_codes", nullable = false, columnDefinition = "varchar(30)[]")
	private String[] unmatchedCodes;

	protected AttendanceImportBatch() {
	}

	public AttendanceImportBatch(UUID schoolId, LocalDate month, UUID fileId, int rowCount, int matchedCount,
			List<String> unmatchedCodes) {
		this.schoolId = schoolId;
		this.month = month;
		this.fileId = fileId;
		this.rowCount = rowCount;
		this.matchedCount = matchedCount;
		this.unmatchedCodes = unmatchedCodes.toArray(String[]::new);
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public LocalDate getMonth() {
		return month;
	}

	public UUID getFileId() {
		return fileId;
	}

	public int getRowCount() {
		return rowCount;
	}

	public int getMatchedCount() {
		return matchedCount;
	}

	public List<String> getUnmatchedCodes() {
		return List.of(unmatchedCodes);
	}

}
