package com.preschool;

import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tạo dữ liệu riêng cho từng test (mã/email ngẫu nhiên) để các test không đụng nhau. */
@Component
public class TestData {

	public static final String PASSWORD = "Matkhau@123";

	private final SchoolRepository schools;

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final com.preschool.staff.repository.StaffRepository staffRepo;

	private final com.preschool.staff.repository.StaffSchoolAssignmentRepository assignments;

	public TestData(SchoolRepository schools, UserRepository users, PasswordEncoder passwordEncoder,
			com.preschool.staff.repository.StaffRepository staffRepo,
			com.preschool.staff.repository.StaffSchoolAssignmentRepository assignments) {
		this.schools = schools;
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.staffRepo = staffRepo;
		this.assignments = assignments;
	}

	public School school() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		return schools.save(new School("T-" + suffix, "Cơ sở thử " + suffix));
	}

	/** Tạo tài khoản với một vai trò; {@code school} rỗng = vai trò toàn chuỗi. */
	@Transactional
	public User user(RoleCode role, School school) {
		return user(role, school, null);
	}

	@Transactional
	public User user(RoleCode role, School school, String phone) {
		String email = role.name().toLowerCase() + "." + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
		User user = new User(email, phone, "Người thử " + role.name(), passwordEncoder.encode(PASSWORD));
		user.addRole(role, school == null ? null : school.getId());
		return users.save(user);
	}

	/** Hồ sơ nhân viên đang làm ở cơ sở (CCCD, SĐT ngẫu nhiên để không trùng giữa các test). */
	@Transactional
	public com.preschool.staff.entity.Staff staff(School school, com.preschool.staff.entity.StaffEnums.Position position) {
		var staff = new com.preschool.staff.entity.Staff(school.getId(), "Nhân viên " + UUID.randomUUID().toString()
			.substring(0, 6), position, java.time.LocalDate.of(2024, 8, 1));
		staff.setCitizenId(randomDigits(12));
		staff.setPhone("09" + randomDigits(8));
		staffRepo.saveAndFlush(staff);
		assignments.save(new com.preschool.staff.entity.StaffSchoolAssignment(staff.getId(), school.getId(),
				staff.getStartDate(), null, null));
		return staffRepo.findById(staff.getId()).orElseThrow();
	}

	/** Tài khoản gắn với hồ sơ nhân viên có sẵn. */
	@Transactional
	public User userForStaff(RoleCode role, School school, com.preschool.staff.entity.Staff staff) {
		User user = user(role, school);
		User managed = users.findById(user.getId()).orElseThrow();
		managed.linkStaff(staff.getId());
		return managed;
	}

	public static String randomDigits(int length) {
		StringBuilder sb = new StringBuilder();
		java.util.concurrent.ThreadLocalRandom random = java.util.concurrent.ThreadLocalRandom.current();
		for (int i = 0; i < length; i++) {
			sb.append(random.nextInt(10));
		}
		return sb.toString();
	}

	@Transactional
	public void deactivate(User user) {
		User managed = users.findById(user.getId()).orElseThrow();
		managed.setActive(false);
	}

}
