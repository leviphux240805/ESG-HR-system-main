package com.preschool.classroom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.IntegrationTest;
import com.preschool.TestData;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Ràng buộc schema lớp học, hồ sơ trẻ, điểm danh (V7). */
@IntegrationTest
class ClassroomSchemaTests {

	@Autowired
	TestData data;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	AgeGroupRepository ageGroups;

	private UUID schoolYear() {
		return jdbc.queryForObject("""
				INSERT INTO school_years (organization_id, name, start_date, end_date) VALUES (?, ?, '2026-08-15', '2027-05-31')
				RETURNING id""", UUID.class, TestData.DEFAULT_ORG, "NH" + TestData.randomDigits(6));
	}

	private UUID newClass(School school, UUID yearId, String name) {
		return jdbc.queryForObject("""
				INSERT INTO classes (school_id, school_year_id, age_group_id, name, capacity)
				VALUES (?, ?, ?, ?, 25) RETURNING id""", UUID.class, school.getId(), yearId,
				ageGroups.findByCode("MAU_GIAO_3_4").orElseThrow().getId(), name);
	}

	private UUID newChild(School school, String name) {
		return jdbc.queryForObject("""
				INSERT INTO children (school_id, full_name, dob, gender, enrolled_at)
				VALUES (?, ?, '2022-05-10', 'FEMALE', '2026-08-15') RETURNING id""", UUID.class, school.getId(), name);
	}

	@Test
	void ageGroupsSeededInOrderWithMaxClassSize() {
		List<String> codes = ageGroups.findAllByOrderByOrderNo().stream().map(g -> g.getCode()).toList();
		assertThat(codes).containsExactly("NHA_TRE", "MAU_GIAO_3_4", "MAU_GIAO_4_5", "MAU_GIAO_5_6");
		assertThat(ageGroups.findByCode("NHA_TRE").orElseThrow().getMaxClassSize()).isPositive();
	}

	@Test
	void childCodeIsGeneratedAndPersonalIdIsUniqueAcrossChain() {
		School schoolA = data.school();
		School schoolB = data.school();
		UUID child = newChild(schoolA, "Nguyễn Thị Bông");
		assertThat(jdbc.queryForObject("SELECT child_code FROM children WHERE id = ?", String.class, child))
			.startsWith("HS");

		String personalId = TestData.randomDigits(12);
		jdbc.update("UPDATE children SET personal_id = ? WHERE id = ?", personalId, child);
		// Cùng mã định danh ở cơ sở khác vẫn bị chặn
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO children (school_id, full_name, dob, gender, enrolled_at, personal_id)
				VALUES (?, 'Trùng mã', '2022-01-01', 'MALE', '2026-08-15', ?)""", schoolB.getId(), personalId))
			.isInstanceOf(DataIntegrityViolationException.class);

		// Xóa mềm thì nhả mã cho hồ sơ mới
		jdbc.update("UPDATE children SET deleted_at = now() WHERE id = ?", child);
		jdbc.update("""
				INSERT INTO children (school_id, full_name, dob, gender, enrolled_at, personal_id)
				VALUES (?, 'Hồ sơ mới', '2022-01-01', 'MALE', '2026-08-15', ?)""", schoolB.getId(), personalId);
	}

	@Test
	void childIsInOneClassAtATimeButHistoryIsKept() {
		School school = data.school();
		UUID year = schoolYear();
		UUID classA = newClass(school, year, "Mầm A");
		UUID classB = newClass(school, year, "Mầm B");
		UUID child = newChild(school, "Trần Gia Bảo");

		jdbc.update("""
				INSERT INTO class_enrollments (school_id, child_id, class_id, from_date)
				VALUES (?, ?, ?, '2026-08-15')""", school.getId(), child, classA);
		// Hai dòng đang hiệu lực cho cùng một trẻ thì bị chặn
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO class_enrollments (school_id, child_id, class_id, from_date)
				VALUES (?, ?, ?, '2026-09-01')""", school.getId(), child, classB))
			.isInstanceOf(DataIntegrityViolationException.class);

		// Đóng dòng cũ rồi mở dòng mới: lịch sử còn đủ hai dòng
		jdbc.update("UPDATE class_enrollments SET to_date = '2026-08-31' WHERE child_id = ?", child);
		jdbc.update("""
				INSERT INTO class_enrollments (school_id, child_id, class_id, from_date)
				VALUES (?, ?, ?, '2026-09-01')""", school.getId(), child, classB);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM class_enrollments WHERE child_id = ?", Integer.class,
				child)).isEqualTo(2);
	}

	@Test
	void attendanceIsOncePerChildPerDayAndStatusIsChecked() {
		School school = data.school();
		UUID year = schoolYear();
		UUID classA = newClass(school, year, "Chồi A");
		UUID child = newChild(school, "Lê Minh Khuê");
		LocalDate day = LocalDate.of(2026, 9, 15);

		jdbc.update("""
				INSERT INTO child_attendance (school_id, child_id, class_id, attend_date, status)
				VALUES (?, ?, ?, ?, 'PRESENT')""", school.getId(), child, classA, day);
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO child_attendance (school_id, child_id, class_id, attend_date, status)
				VALUES (?, ?, ?, ?, 'ABSENT')""", school.getId(), child, classA, day))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO child_attendance (school_id, child_id, class_id, attend_date, status)
				VALUES (?, ?, ?, '2026-09-16', 'VANG')""", school.getId(), child, classA))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void mealCutoffDefaultsToChainWideConfig() {
		assertThat(jdbc.queryForObject("""
				SELECT meal_cutoff_time::text FROM child_attendance_configs WHERE school_id IS NULL""", String.class))
			.isEqualTo("08:30:00");
	}

	@Test
	void onlyOnePrimaryGuardianPerChild() {
		School school = data.school();
		UUID child = newChild(school, "Phạm Bảo An");
		UUID mother = jdbc.queryForObject("""
				INSERT INTO guardians (school_id, full_name, phone) VALUES (?, 'Mẹ', ?) RETURNING id""", UUID.class,
				school.getId(), "09" + TestData.randomDigits(8));
		UUID father = jdbc.queryForObject("""
				INSERT INTO guardians (school_id, full_name, phone) VALUES (?, 'Bố', ?) RETURNING id""", UUID.class,
				school.getId(), "09" + TestData.randomDigits(8));

		jdbc.update("""
				INSERT INTO child_guardians (school_id, child_id, guardian_id, relationship, is_primary)
				VALUES (?, ?, ?, 'Mẹ', true)""", school.getId(), child, mother);
		assertThatThrownBy(() -> jdbc.update("""
				INSERT INTO child_guardians (school_id, child_id, guardian_id, relationship, is_primary)
				VALUES (?, ?, ?, 'Bố', true)""", school.getId(), child, father))
			.isInstanceOf(DataIntegrityViolationException.class);
		// Người thứ hai không phải liên hệ chính thì được
		jdbc.update("""
				INSERT INTO child_guardians (school_id, child_id, guardian_id, relationship, is_primary)
				VALUES (?, ?, ?, 'Bố', false)""", school.getId(), child, father);
	}

}
