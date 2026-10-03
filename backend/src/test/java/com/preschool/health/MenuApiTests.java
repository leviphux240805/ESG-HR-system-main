package com.preschool.health;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import com.jayway.jsonpath.JsonPath;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Thực đơn: cấp dưỡng chỉ sửa thực đơn trường mình, giáo viên chỉ xem, kế toán không truy cập; món chung chuỗi chỉ văn
 * phòng điều hành sửa; sao chép tuần; cảnh báo dị ứng liệt kê mọi trẻ có ghi chú dị ứng.
 */
class MenuApiTests extends HealthApiTestBase {

	static final LocalDate WEEK = LocalDate.of(2030, 1, 7);

	User kitchenA;

	User kitchenB;

	User teacherA;

	User accountantA;

	String classId;

	@BeforeEach
	void setUp() throws Exception {
		setUpSchools();
		kitchenA = data.user(RoleCode.KITCHEN, schoolA);
		kitchenB = data.user(RoleCode.KITCHEN, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		classId = createClass("Chồi 1");
		teacherA = teacherOf(classId);
	}

	private String createDish(User user, School school, String name, String ingredient, boolean shared)
			throws Exception {
		String body = as(user, post("/api/v1/dishes").contentType(MediaType.APPLICATION_JSON).content("""
				{"name":"%s","ingredients":[{"name":"%s","grams":30}],"kcal":150,"proteinG":8,"shared":%s}"""
			.formatted(name, ingredient, shared)), school == null ? null : school.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private ResultActions saveWeek(User user, School school, LocalDate week, String items) throws Exception {
		return as(user, put("/api/v1/menus/week").contentType(MediaType.APPLICATION_JSON).content("""
				{"weekStart":"%s","items":%s}""".formatted(week, items)), school.getId());
	}

	private static String item(LocalDate date, String meal, String dishId) {
		return "{\"date\":\"%s\",\"meal\":\"%s\",\"dishId\":\"%s\"}".formatted(date, meal, dishId);
	}

	@Test
	void kitchenEditsOnlyOwnSchoolMenu() throws Exception {
		String chao = createDish(kitchenA, schoolA, "Cháo tôm", "Tôm", false);
		saveWeek(kitchenA, schoolA, WEEK, "[%s,%s]".formatted(item(WEEK, "LUNCH", chao), item(WEEK.plusDays(1), "BREAKFAST", chao)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.canEdit").value(true))
			.andExpect(jsonPath("$.days[0].kcal").value(150));

		saveWeek(kitchenB, schoolA, WEEK, "[]").andExpect(status().isForbidden());
		as(kitchenB, get("/api/v1/menus/week?weekStart=" + WEEK), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)));
		as(kitchenB, put("/api/v1/dishes/" + chao).contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Đổi tên\",\"ingredients\":[]}"), schoolB.getId()).andExpect(status().isNotFound());
		saveWeek(kitchenB, schoolB, WEEK, "[%s]".formatted(item(WEEK, "LUNCH", chao)))
			.andExpect(status().isBadRequest());

		as(teacherA, get("/api/v1/menus/week?weekStart=" + WEEK), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.canEdit").value(false));
		saveWeek(teacherA, schoolA, WEEK, "[]").andExpect(status().isForbidden());
		as(accountantA, get("/api/v1/menus/week?weekStart=" + WEEK), schoolA.getId())
			.andExpect(status().isForbidden());
		saveWeek(principalA, schoolA, WEEK, "[%s]".formatted(item(WEEK, "SNACK", chao))).andExpect(status().isOk());
	}

	@Test
	void sharedDishesBelongToChainAdmin() throws Exception {
		as(kitchenA, post("/api/v1/dishes").contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Cơm\",\"ingredients\":[],\"shared\":true}"), schoolA.getId())
			.andExpect(status().isForbidden());
		String com = createDish(admin, null, "Cơm trắng " + System.nanoTime(), "Gạo", true);
		as(kitchenA, get("/api/v1/dishes?q=com trang"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[?(@.id=='%s')].canEdit".formatted(com)).value(false));
		as(kitchenA, put("/api/v1/dishes/" + com).contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Đổi\",\"ingredients\":[]}"), schoolA.getId()).andExpect(status().isForbidden());
		saveWeek(kitchenA, schoolA, WEEK, "[%s]".formatted(item(WEEK, "LUNCH", com))).andExpect(status().isOk());
		as(admin, delete("/api/v1/dishes/" + com)).andExpect(status().isConflict());
	}

	@Test
	void copyWeekShiftsDatesAndAsksBeforeOverwrite() throws Exception {
		String dish = createDish(kitchenA, schoolA, "Canh bí", "Bí đao", false);
		saveWeek(kitchenA, schoolA, WEEK, "[%s]".formatted(item(WEEK.plusDays(2), "LUNCH", dish)))
			.andExpect(status().isOk());
		String copy = """
				{"fromWeekStart":"%s","toWeekStart":"%s","overwrite":%s}""";
		LocalDate next = WEEK.plusWeeks(1);
		as(kitchenA, post("/api/v1/menus/copy").contentType(MediaType.APPLICATION_JSON)
			.content(copy.formatted(WEEK, next, false)), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.weekStart").value(next.toString()))
			.andExpect(jsonPath("$.items[0].date").value(next.plusDays(2).toString()));
		as(kitchenA, post("/api/v1/menus/copy").contentType(MediaType.APPLICATION_JSON)
			.content(copy.formatted(WEEK, next, false)), schoolA.getId()).andExpect(status().isConflict());
		as(kitchenA, post("/api/v1/menus/copy").contentType(MediaType.APPLICATION_JSON)
			.content(copy.formatted(WEEK, next, true)), schoolA.getId()).andExpect(status().isOk());
		as(kitchenA, get("/api/v1/menus/week?weekStart=" + WEEK.plusDays(1)), schoolA.getId())
			.andExpect(status().isBadRequest());
		as(kitchenB, post("/api/v1/menus/copy").contentType(MediaType.APPLICATION_JSON)
			.content(copy.formatted(WEEK, next, true)), schoolB.getId()).andExpect(status().isBadRequest());
	}

	@Test
	void allergyWarningsListEveryAllergicChild() throws Exception {
		String tom = enroll("An", classId, "Dị ứng tôm, sữa bò");
		String hanh = enroll("Bình", classId, "Không ăn được hành");
		enroll("Cường", classId, null);
		String dish = createDish(kitchenA, schoolA, "Cháo tôm thịt", "Tôm sú", false);
		saveWeek(kitchenA, schoolA, WEEK, "[%s]".formatted(item(WEEK, "LUNCH", dish)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.allergyAlerts").value(1));
		as(teacherA, get("/api/v1/menus/allergy-warnings?weekStart=" + WEEK), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].childId").value(tom))
			.andExpect(jsonPath("$[0].matches[0].ingredient").value("Tôm sú"))
			.andExpect(jsonPath("$[1].childId").value(hanh))
			.andExpect(jsonPath("$[1].matches", hasSize(0)));
		as(principalB, get("/api/v1/menus/allergy-warnings?weekStart=" + WEEK), schoolB.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void publishNeedsItemsAndEditor() throws Exception {
		String dish = createDish(kitchenA, schoolA, "Bún bò", "Thịt bò", false);
		String body = saveWeek(kitchenA, schoolA, WEEK, "[%s]".formatted(item(WEEK, "LUNCH", dish)))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String menuId = JsonPath.read(body, "$.id");
		as(teacherA, post("/api/v1/menus/" + menuId + "/publish"), schoolA.getId()).andExpect(status().isForbidden());
		as(kitchenB, post("/api/v1/menus/" + menuId + "/publish"), schoolB.getId()).andExpect(status().isNotFound());
		as(kitchenA, post("/api/v1/menus/" + menuId + "/publish"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PUBLISHED"));
	}

	@Test
	void portionsFollowPresentChildrenOrClassSize() throws Exception {
		LocalDate day = today.getDayOfWeek() == java.time.DayOfWeek.SUNDAY ? today.minusDays(1) : today;
		LocalDate week = day.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
		LocalDate other = day.equals(week) ? week.plusDays(1) : week;
		String an = enroll("An", classId, null);
		String binh = enroll("Bình", classId, null);
		String cuong = enroll("Cường", classId, null);
		as(principalA, put("/api/v1/classes/" + classId + "/attendance").contentType(MediaType.APPLICATION_JSON).content("""
				{"date":"%s","rows":[{"childId":"%s","status":"PRESENT"},{"childId":"%s","status":"PRESENT"},{"childId":"%s","status":"EXCUSED"}]}"""
			.formatted(day, an, binh, cuong)), schoolA.getId()).andExpect(status().isOk());
		String dish = createDish(kitchenA, schoolA, "Cơm gà", "Gà", false);
		saveWeek(kitchenA, schoolA, week, "[%s,%s]".formatted(item(day, "LUNCH", dish), item(other, "LUNCH", dish)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days[?(@.date=='%s')].portions".formatted(day)).value(2))
			.andExpect(jsonPath("$.days[?(@.date=='%s')].portionsEstimated".formatted(day)).value(false))
			.andExpect(jsonPath("$.days[?(@.date=='%s')].portions".formatted(other)).value(3))
			.andExpect(jsonPath("$.days[?(@.date=='%s')].portionsEstimated".formatted(other)).value(true));
	}

}
