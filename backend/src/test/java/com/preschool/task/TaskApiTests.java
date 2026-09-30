package com.preschool.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.notification.repository.NotificationRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Công việc: giao việc và quyền chuyển trạng thái (người nhận chỉ tới Chờ duyệt), nhân viên chỉ thấy việc của
 * mình, và cơ sở A không đụng được việc của cơ sở B.
 */
class TaskApiTests extends ApiTestSupport {

	@Autowired
	NotificationRepository notificationRepo;

	School schoolA;

	School schoolB;

	Staff teacherStaff;

	Staff cookStaff;

	User teacher;

	User cook;

	User principalA;

	User principalB;

	User admin;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		teacherStaff = data.staff(schoolA, Position.TEACHER);
		teacher = data.userForStaff(RoleCode.TEACHER, schoolA, teacherStaff);
		cookStaff = data.staff(schoolA, Position.COOK);
		cook = data.userForStaff(RoleCode.KITCHEN, schoolA, cookStaff);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		admin = data.user(RoleCode.CHAIN_ADMIN, null);
	}

	private ResultActions create(User user, School school, String title, Staff assignee) throws Exception {
		String schoolJson = school == null ? "null" : "\"" + school.getId() + "\"";
		return as(user,
				post("/api/v1/tasks").contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"schoolId":%s,"title":"%s","priority":"HIGH","dueAt":"2026-10-20T10:00:00Z",
							 "assigneeStaffIds":["%s"],"checklist":["Chuẩn bị vật tư","Báo cáo kết quả"]}"""
						.formatted(schoolJson, title, assignee.getId())),
				school == null ? null : school.getId());
	}

	private ResultActions setStatus(User user, String id, String status, School school) throws Exception {
		return as(user, patch("/api/v1/tasks/" + id + "/status").contentType(MediaType.APPLICATION_JSON)
			.content("{\"status\":\"%s\"}".formatted(status)), school == null ? null : school.getId());
	}

	@Test
	void principalAssignsTaskAndAssigneeIsNotified() throws Exception {
		String id = JsonPath.read(create(principalA, schoolA, "Tổng vệ sinh lớp", teacherStaff).andExpect(status().isCreated())
			.andExpect(jsonPath("$.status").value("NEW"))
			.andExpect(jsonPath("$.checklistTotal").value(2))
			.andExpect(jsonPath("$.assignees[0].staffId").value(teacherStaff.getId().toString()))
			.andReturn().getResponse().getContentAsString(), "$.id");

		assertThat(notificationRepo.findAll()
			.stream()
			.filter(n -> n.getUserId().equals(teacher.getId())
					&& ("task-assigned:" + id + ":" + teacherStaff.getId()).equals(n.getDedupeKey())))
			.hasSize(1);

		// Người nhận thấy việc ở "Việc của tôi" và mở được chi tiết
		as(teacher, get("/api/v1/me/tasks")).andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(id))
			.andExpect(jsonPath("$[0].canEdit").value(false));
		as(teacher, get("/api/v1/tasks/" + id), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.assignee").value(true))
			.andExpect(jsonPath("$.checklist.length()").value(2))
			.andExpect(jsonPath("$.history[0].description").value("Tạo việc"));
	}

	@Test
	void onlyAssignerClosesTheTask() throws Exception {
		String id = JsonPath.read(create(principalA, schoolA, "Kiểm tra đồ chơi ngoài trời", teacherStaff).andReturn()
			.getResponse().getContentAsString(), "$.id");

		// Người nhận đẩy được tới "Chờ duyệt"
		setStatus(teacher, id, "IN_PROGRESS", schoolA).andExpect(status().isOk());
		setStatus(teacher, id, "WAITING_APPROVAL", schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("WAITING_APPROVAL"))
			.andExpect(jsonPath("$.allowedStatuses", not(hasItem("DONE"))));
		// ...nhưng không tự kết thúc được
		setStatus(teacher, id, "DONE", schoolA).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("TASK_STATUS_FORBIDDEN"));
		setStatus(teacher, id, "CANCELLED", schoolA).andExpect(status().isForbidden());

		// Người giao duyệt bước cuối; lịch sử ghi lại các lần đổi trạng thái
		setStatus(principalA, id, "DONE", schoolA).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("DONE"))
			.andExpect(jsonPath("$.completedAt").isNotEmpty());
		as(principalA, get("/api/v1/tasks/" + id), schoolA.getId())
			.andExpect(jsonPath("$.history[0].description").value("Chuyển sang Hoàn thành"))
			.andExpect(jsonPath("$.history.length()").value(4));

		// Việc đã kết thúc thì không cập nhật tiếp
		as(teacher, post("/api/v1/tasks/" + id + "/comments").contentType(MediaType.APPLICATION_JSON)
			.content("{\"body\":\"Đã xong ạ\"}"), schoolA.getId()).andExpect(status().isCreated());
		setStatus(principalA, id, "IN_PROGRESS", schoolA).andExpect(status().isOk());
	}

	@Test
	void staffSeesOnlyOwnTasksAndCannotAssign() throws Exception {
		String mine = JsonPath.read(create(principalA, schoolA, "Việc của giáo viên", teacherStaff).andReturn()
			.getResponse().getContentAsString(), "$.id");
		String others = JsonPath.read(create(principalA, schoolA, "Việc của cấp dưỡng", cookStaff).andReturn()
			.getResponse().getContentAsString(), "$.id");

		as(teacher, get("/api/v1/tasks"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", hasItem(mine)))
			.andExpect(jsonPath("$.items[*].id", not(hasItem(others))));
		as(teacher, get("/api/v1/tasks/" + others), schoolA.getId()).andExpect(status().isNotFound());
		as(teacher, get("/api/v1/me/tasks")).andExpect(jsonPath("$.length()").value(1));

		// Giáo viên không giao được việc
		create(teacher, schoolA, "Tự giao việc", teacherStaff).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("TASK_FORBIDDEN"));

		// Hiệu trưởng thấy cả hai việc của cơ sở mình
		as(principalA, get("/api/v1/tasks"), schoolA.getId()).andExpect(jsonPath("$.totalElements").value(2));
	}

	@Test
	void otherSchoolCannotSeeOrChangeTask() throws Exception {
		String id = JsonPath.read(create(principalA, schoolA, "Chuẩn bị họp phụ huynh", teacherStaff).andReturn()
			.getResponse().getContentAsString(), "$.id");

		as(principalB, get("/api/v1/tasks"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));
		as(principalB, get("/api/v1/tasks/" + id), schoolB.getId()).andExpect(status().isNotFound());
		setStatus(principalB, id, "DONE", schoolB).andExpect(status().isNotFound());
		as(principalB, delete("/api/v1/tasks/" + id + "/attachments/" + java.util.UUID.randomUUID()), schoolB.getId())
			.andExpect(status().isNotFound());

		// Không giao được việc cho nhân viên cơ sở khác
		as(principalB, post("/api/v1/tasks").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolId":"%s","title":"Việc lạ","priority":"LOW","assigneeStaffIds":["%s"]}"""
			.formatted(schoolB.getId(), teacherStaff.getId())), schoolB.getId())
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("assigneeStaffIds"));
	}

	@Test
	void chainTaskIsForChainAdminOnly() throws Exception {
		// Hiệu trưởng không giao được việc toàn chuỗi
		create(principalA, null, "Việc toàn chuỗi", teacherStaff).andExpect(status().isForbidden());

		String id = JsonPath.read(create(admin, null, "Rà soát hồ sơ toàn chuỗi", teacherStaff).andExpect(status().isCreated())
			.andExpect(jsonPath("$.schoolId").doesNotExist())
			.andReturn().getResponse().getContentAsString(), "$.id");

		// Người nhận vẫn thấy việc toàn chuỗi của mình
		as(teacher, get("/api/v1/me/tasks")).andExpect(jsonPath("$[0].id").value(id));
		// Nhưng cấp dưỡng cùng cơ sở thì không
		as(cook, get("/api/v1/tasks/" + id), schoolA.getId()).andExpect(status().isNotFound());
	}

	@Test
	void checklistTrackedByAssigneeAndTaskIsEditable() throws Exception {
		String body = create(principalA, schoolA, "Trang trí góc thiên nhiên", teacherStaff).andReturn().getResponse()
			.getContentAsString();
		String id = JsonPath.read(body, "$.id");
		String itemId = JsonPath.read(
				as(principalA, get("/api/v1/tasks/" + id), schoolA.getId()).andReturn().getResponse().getContentAsString(),
				"$.checklist[0].id");

		// Người nhận tick được checklist (báo tiến độ) nhưng không thêm, không xóa mục
		as(teacher, put("/api/v1/tasks/" + id + "/checklist/" + itemId).contentType(MediaType.APPLICATION_JSON)
			.content("{\"done\":true}"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.done").value(true));
		as(teacher, post("/api/v1/tasks/" + id + "/checklist").contentType(MediaType.APPLICATION_JSON)
			.content("{\"content\":\"Mục mới\"}"), schoolA.getId()).andExpect(status().isForbidden());
		as(teacher, put("/api/v1/tasks/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"title":"Đổi tên","priority":"LOW","assigneeStaffIds":["%s"]}""".formatted(teacherStaff.getId())),
				schoolA.getId()).andExpect(status().isForbidden());

		as(principalA, get("/api/v1/tasks"), schoolA.getId())
			.andExpect(jsonPath("$.items[0].checklistDone").value(1))
			.andExpect(jsonPath("$.items[0].checklistTotal").value(2));

		// Người giao đổi người nhận: người mới được báo, người cũ mất quyền xem
		as(principalA, put("/api/v1/tasks/" + id).contentType(MediaType.APPLICATION_JSON).content("""
				{"title":"Trang trí góc thiên nhiên","priority":"MEDIUM","assigneeStaffIds":["%s"]}"""
			.formatted(cookStaff.getId())), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.assignees.length()").value(1))
			.andExpect(jsonPath("$.assignees[0].staffId").value(cookStaff.getId().toString()));
		as(teacher, get("/api/v1/tasks/" + id), schoolA.getId()).andExpect(status().isNotFound());
		as(cook, get("/api/v1/me/tasks")).andExpect(jsonPath("$[0].id").value(id));
	}

}
