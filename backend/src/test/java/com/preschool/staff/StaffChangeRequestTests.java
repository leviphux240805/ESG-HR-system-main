package com.preschool.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.notification.repository.NotificationRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;
import com.preschool.staff.repository.StaffRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Hồ sơ của tôi, đề xuất cập nhật và quyền duyệt (liên hệ: hiệu trưởng/VPĐH; ngân hàng: VPĐH/kế toán). */
class StaffChangeRequestTests extends ApiTestSupport {

	@Autowired
	StaffRepository staffRepo;

	@Autowired
	NotificationRepository notificationRepo;

	School schoolA;

	School schoolB;

	Staff teacherStaff;

	User teacher;

	User principalA;

	User principalB;

	User accountantA;

	User admin;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		admin = data.principal(schoolA, schoolB);
	}

	@Test
	void myProfileRequiresLinkedStaff() throws Exception {
		as(teacher, get("/api/v1/me/staff")).andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(teacherStaff.getId().toString()))
			.andExpect(jsonPath("$.permissions.isSelf").value(true))
			.andExpect(jsonPath("$.permissions.canEdit").value(false));
		as(principalA, get("/api/v1/me/staff")).andExpect(status().isNotFound());
		as(principalA, get("/api/v1/me/library/documents")).andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void contactChangeIsApprovedByPrincipalOfThatSchoolOnly() throws Exception {
		String newPhone = "08" + com.preschool.TestData.randomDigits(8);
		String id = submit(teacher, "{\"phone\":\"%s\",\"permAddressDetail\":\"Số 5 ngõ Mới\"}".formatted(newPhone))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.kind").value("CONTACT"))
			.andExpect(jsonPath("$.status").value("PENDING"))
			.andExpect(jsonPath("$.changes[?(@.field == 'phone')].from").value(teacherStaff.getPhone()))
			.andReturn().getResponse().getContentAsString();
		id = JsonPath.read(id, "$.id");
		assertThat(notificationRepo.findAll().stream()
			.filter(n -> n.getUserId().equals(principalA.getId()) && "/nhan-su/de-xuat".equals(n.getLink()))).hasSize(1);

		// Đề xuất liên hệ thứ hai khi còn chờ duyệt bị chặn
		submit(teacher, "{\"phone\":\"0987000111\"}").andExpect(status().isConflict());

		// Hiệu trưởng cơ sở khác không thấy, kế toán không duyệt liên hệ
		as(principalB, get("/api/v1/staff/change-requests?status=PENDING"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));
		as(principalB, post("/api/v1/staff/change-requests/" + id + "/approve"), schoolB.getId())
			.andExpect(status().isNotFound());
		as(accountantA, post("/api/v1/staff/change-requests/" + id + "/approve"), schoolA.getId())
			.andExpect(status().isForbidden());
		as(accountantA, get("/api/v1/staff/change-requests?status=PENDING"), schoolA.getId())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));

		as(principalA, get("/api/v1/staff/change-requests?status=PENDING"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[?(@.id == '%s')].canReview".formatted(id)).value(true));
		as(principalA, post("/api/v1/staff/change-requests/" + id + "/approve"), schoolA.getId())
			.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
		as(principalA, post("/api/v1/staff/change-requests/" + id + "/approve"), schoolA.getId())
			.andExpect(status().isConflict());

		Staff updated = staffRepo.findById(teacherStaff.getId()).orElseThrow();
		assertThat(updated.getPhone()).isEqualTo(newPhone);
		assertThat(updated.getPermAddressDetail()).isEqualTo("Số 5 ngõ Mới");
		as(teacher, get("/api/v1/me/change-requests")).andExpect(jsonPath("$[0].status").value("APPROVED"));
		as(principalA, get("/api/v1/staff/" + teacherStaff.getId() + "/history"), schoolA.getId())
			.andExpect(jsonPath("$.events[0].entity").value("staff"))
			.andExpect(jsonPath("$.events[0].after.phone").value(newPhone));
	}

	@Test
	void bankChangeIsApprovedByAccountantNotHrVicePrincipal() throws Exception {
		User viceHr = data.vicePrincipal(schoolA, FunctionGroup.HR);
		String id = JsonPath.read(submit(teacher,
				"{\"bankName\":\"Vietcombank\",\"bankAccountNo\":\"0123456789\",\"bankAccountHolder\":\"NGUYEN VAN A\"}")
			.andExpect(status().isCreated()).andExpect(jsonPath("$.kind").value("BANK"))
			.andReturn().getResponse().getContentAsString(), "$.id");

		as(viceHr, get("/api/v1/staff/change-requests"), schoolA.getId())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));
		as(viceHr, post("/api/v1/staff/change-requests/" + id + "/approve"), schoolA.getId())
			.andExpect(status().isForbidden());
		as(accountantA, post("/api/v1/staff/change-requests/" + id + "/reject"), schoolA.getId())
			.andExpect(status().isBadRequest());
		as(accountantA, post("/api/v1/staff/change-requests/" + id + "/approve"), schoolA.getId())
			.andExpect(status().isOk());
		assertThat(staffRepo.findById(teacherStaff.getId()).orElseThrow().getBankAccountNo()).isEqualTo("0123456789");
	}

	@Test
	void invalidRequestsAreRejected() throws Exception {
		Staff other = data.staff(schoolB, Position.TEACHER);
		submit(teacher, "{\"phone\":\"%s\"}".formatted(other.getPhone())).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("phone"));
		submit(teacher, "{\"phone\":\"0912345678\",\"bankName\":\"ACB\"}").andExpect(status().isBadRequest());
		submit(teacher, "{\"fullName\":\"Tên khác\"}").andExpect(status().isBadRequest());
		submit(teacher, "{\"phone\":\"%s\"}".formatted(teacherStaff.getPhone())).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("NO_CHANGES"));
		submit(principalA, "{\"phone\":\"0912345678\"}").andExpect(status().isNotFound());

		String id = JsonPath.read(submit(teacher, "{\"currAddressDetail\":\"Phòng 3\"}").andExpect(status().isCreated())
			.andReturn().getResponse().getContentAsString(), "$.id");
		as(admin, post("/api/v1/staff/change-requests/" + id + "/reject").contentType(MediaType.APPLICATION_JSON)
			.content("{\"note\":\"Địa chỉ chưa đủ\"}"), schoolA.getId())
			.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"))
			.andExpect(jsonPath("$.reviewNote").value("Địa chỉ chưa đủ"));
		assertThat(staffRepo.findById(teacherStaff.getId()).orElseThrow().getCurrAddressDetail()).isNotEqualTo("Phòng 3");
	}

	private ResultActions submit(User user, String changes) throws Exception {
		return as(user, post("/api/v1/me/change-requests").contentType(MediaType.APPLICATION_JSON)
			.content("{\"changes\":%s}".formatted(changes)));
	}

}
