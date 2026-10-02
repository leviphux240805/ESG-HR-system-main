package com.preschool;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleAssignment;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tạo dữ liệu riêng cho từng test (mã/email ngẫu nhiên) để các test không đụng nhau. */
@Component
public class TestData {

	public static final String PASSWORD = "Matkhau@123";

	/** Ngày nghiệp vụ theo giờ Việt Nam, như backend (đồng hồ hệ thống là UTC). */
	public static final java.time.ZoneId VN = java.time.ZoneId.of(com.preschool.common.jobs.SchedulingConfig.ZONE);

	/** Tổ chức mặc định (V13): có sẵn danh mục khối, khoản thu, danh mục thu chi. */
	public static final UUID DEFAULT_ORG = UUID.fromString("00000000-0000-0000-0000-0000000000f0");

	private final SchoolRepository schools;

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final com.preschool.staff.repository.StaffRepository staffRepo;

	private final com.preschool.staff.repository.StaffSchoolAssignmentRepository assignments;

	private final NamedParameterJdbcTemplate jdbc;

	public TestData(SchoolRepository schools, UserRepository users, PasswordEncoder passwordEncoder,
			com.preschool.staff.repository.StaffRepository staffRepo,
			com.preschool.staff.repository.StaffSchoolAssignmentRepository assignments, NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
		this.schools = schools;
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.staffRepo = staffRepo;
		this.assignments = assignments;
	}

	/** Trường mới trong tổ chức mặc định. */
	public School school() {
		return school(DEFAULT_ORG);
	}

	public School school(UUID organizationId) {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		return schools.save(new School(organizationId, "T-" + suffix, "Trường thử " + suffix));
	}

	/**
	 * Tổ chức mới, không chép danh mục (để tra cứu danh mục theo mã ngoài request vẫn chỉ ra một dòng của tổ chức mặc
	 * định). Dùng cho test cách ly giữa hai hiệu trưởng.
	 */
	public UUID organization() {
		UUID id = UUID.randomUUID();
		jdbc.update("INSERT INTO organizations (id, name) VALUES (:id, :name)",
				new MapSqlParameterSource("id", id).addValue("name", "Tổ chức thử " + id.toString().substring(0, 8)));
		return id;
	}

	/** Tài khoản với một vai trò ở các trường {@code schools} (cùng tổ chức). */
	@Transactional
	public User user(RoleCode role, School... schools) {
		return save(role.name(), null, Arrays.stream(schools).map(s -> new RoleAssignment(role, s.getId())).toList(),
				schools[0].getOrganizationId());
	}

	@Transactional
	public User user(RoleCode role, School school, String phone) {
		return save(role.name(), phone, java.util.List.of(new RoleAssignment(role, school.getId())),
				school.getOrganizationId());
	}

	/** Hiệu trưởng của các trường {@code schools}. */
	@Transactional
	public User principal(School... schools) {
		return user(RoleCode.PRINCIPAL, schools);
	}

	/** Phó hiệu trưởng ở một trường với các nhóm chức năng được giao. */
	@Transactional
	public User vicePrincipal(School school, FunctionGroup... groups) {
		return save("VICE_PRINCIPAL", null,
				java.util.List.of(new RoleAssignment(RoleCode.VICE_PRINCIPAL, school.getId(), Set.of(groups))),
				school.getOrganizationId());
	}

	private User save(String label, String phone, java.util.List<RoleAssignment> roles, UUID organizationId) {
		String email = label.toLowerCase() + "." + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
		User user = new User(organizationId, email, phone, "Người thử " + label, passwordEncoder.encode(PASSWORD));
		roles.forEach(user::addRole);
		return users.save(user);
	}

	/** Gắn bản ghi dùng chung vào tổ chức mặc định trước khi lưu thẳng qua repository (ngoài request). */
	public static <T extends com.preschool.common.jpa.OrganizationEntity> T inDefaultOrg(T entity) {
		entity.assignOrganization(DEFAULT_ORG);
		return entity;
	}

	/** Hồ sơ nhân viên đang làm ở trường (CCCD, SĐT ngẫu nhiên để không trùng giữa các test). */
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
		return link(user(role, school), staff);
	}

	/** Gắn tài khoản đã tạo với hồ sơ nhân viên. */
	@Transactional
	public User link(User user, com.preschool.staff.entity.Staff staff) {
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
