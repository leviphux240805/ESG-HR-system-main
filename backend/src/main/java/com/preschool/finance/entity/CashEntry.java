package com.preschool.finance.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.preschool.common.jpa.BaseEntity;
import com.preschool.common.jpa.SchoolFilter;
import com.preschool.finance.entity.FinanceEnums.CashSource;
import com.preschool.finance.entity.FinanceEnums.Direction;

import org.hibernate.annotations.Filter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Một dòng sổ thu chi của cơ sở. Dòng tự sinh (thanh toán học phí, lương) không sửa tay được. */
@Entity
@Table(name = "cash_entries")
@Filter(name = SchoolFilter.NAME)
public class CashEntry extends BaseEntity {

	@Column(name = "school_id", nullable = false)
	private UUID schoolId;

	@Column(name = "category_id", nullable = false)
	private UUID categoryId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Direction direction;

	@Column(nullable = false)
	private BigDecimal amount;

	@Column(name = "entry_date", nullable = false)
	private LocalDate entryDate;

	@Column(nullable = false)
	private String description;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private CashSource source = CashSource.MANUAL;

	@Column(name = "source_id")
	private UUID sourceId;

	@Column(name = "file_id")
	private UUID fileId;

	protected CashEntry() {
	}

	public CashEntry(UUID schoolId, CashSource source, UUID sourceId) {
		this.schoolId = schoolId;
		this.source = source;
		this.sourceId = sourceId;
	}

	public void update(UUID categoryId, Direction direction, BigDecimal amount, LocalDate entryDate,
			String description, UUID fileId) {
		this.categoryId = categoryId;
		this.direction = direction;
		this.amount = amount;
		this.entryDate = entryDate;
		this.description = description;
		this.fileId = fileId;
	}

	public boolean isManual() {
		return source == CashSource.MANUAL;
	}

	public UUID getSchoolId() {
		return schoolId;
	}

	public UUID getCategoryId() {
		return categoryId;
	}

	public Direction getDirection() {
		return direction;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public LocalDate getEntryDate() {
		return entryDate;
	}

	public String getDescription() {
		return description;
	}

	public CashSource getSource() {
		return source;
	}

	public UUID getSourceId() {
		return sourceId;
	}

	public UUID getFileId() {
		return fileId;
	}

}
