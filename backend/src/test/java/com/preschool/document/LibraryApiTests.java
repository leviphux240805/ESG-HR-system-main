package com.preschool.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.notification.repository.NotificationRepository;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Thư viện văn bản: phạm vi cơ sở + vai trò, quyền ban hành, xác nhận đã đọc, phiên bản, nhắc. */
class LibraryApiTests extends ApiTestSupport {

	@Autowired
	NotificationRepository notificationRepo;

	School schoolA;

	School schoolB;

	User admin;

	User principalA;

	User teacherA;

	User teacherA2;

	User nurseA;

	User teacherB;

	@BeforeEach
	void setUp() {
		schoolA = data.school();
		schoolB = data.school();
		admin = data.user(RoleCode.CHAIN_ADMIN, null);
		principalA = data.userForStaff(RoleCode.PRINCIPAL, schoolA, data.staff(schoolA, Position.MANAGER));
		teacherA = data.userForStaff(RoleCode.TEACHER, schoolA, data.staff(schoolA, Position.TEACHER));
		teacherA2 = data.userForStaff(RoleCode.TEACHER, schoolA, data.staff(schoolA, Position.TEACHER));
		nurseA = data.userForStaff(RoleCode.NURSE, schoolA, data.staff(schoolA, Position.NURSE));
		teacherB = data.userForStaff(RoleCode.TEACHER, schoolB, data.staff(schoolB, Position.TEACHER));
	}

	@Test
	void schoolDocumentIsInvisibleToOtherSchools() throws Exception {
		String id = publish(principalA, schoolA.getId(), "Nội quy Cơ sở A", "[]", false);

		as(teacherA, get(doc(id)), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.document.title").value("Nội quy Cơ sở A"))
			.andExpect(jsonPath("$.document.canManage").value(false));
		as(teacherB, get(doc(id)), schoolB.getId()).andExpect(status().isNotFound());
		as(teacherB, get("/api/v1/library/documents"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));
		as(teacherB, post(doc(id) + "/ack"), schoolB.getId()).andExpect(status().isNotFound());
		as(teacherB, get(doc(id) + "/versions/1/download-url"), schoolB.getId()).andExpect(status().isNotFound());
		as(teacherA, get(doc(id) + "/versions/1/download-url?inline=true"), schoolA.getId())
			.andExpect(status().isOk()).andExpect(jsonPath("$.url").isNotEmpty());
	}

	@Test
	void visibleRolesLimitWhoSeesTheDocument() throws Exception {
		String id = publish(principalA, schoolA.getId(), "Quy trình chăm sóc trẻ", "[\"TEACHER\"]", false);

		as(teacherA, get(doc(id)), schoolA.getId()).andExpect(status().isOk());
		as(nurseA, get(doc(id)), schoolA.getId()).andExpect(status().isNotFound());
		as(nurseA, get("/api/v1/library/documents"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", not(hasItem(id))));
		as(teacherA, get("/api/v1/library/documents?q=chăm sóc"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[*].id", hasItem(id)));
		// Người ban hành luôn thấy văn bản mình quản lý
		as(principalA, get(doc(id)), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.document.canManage").value(true));
	}

	@Test
	void onlyPublishersCanIssueAndChainWideNeedsChainRole() throws Exception {
		String fileT = uploadPdf(teacherA, "gv.pdf");
		createDocument(teacherA, schoolA.getId(), "Giáo viên ban hành", "[]", false, fileT)
			.andExpect(status().isForbidden());
		String fileP = uploadPdf(principalA, "ht.pdf");
		createDocument(principalA, null, "Văn bản toàn chuỗi", "[]", false, fileP).andExpect(status().isForbidden());
		createDocument(principalA, schoolB.getId(), "Văn bản cơ sở khác", "[]", false, fileP)
			.andExpect(status().isForbidden());
		as(teacherA, post("/api/v1/library/folders").contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Thư mục GV\",\"schoolId\":\"%s\"}".formatted(schoolA.getId())), schoolA.getId())
			.andExpect(status().isForbidden());

		String chainId = publish(admin, null, "Quy chế chung", "[]", false);
		as(teacherA, get(doc(chainId)), schoolA.getId()).andExpect(status().isOk());
		as(teacherB, get(doc(chainId)), schoolB.getId()).andExpect(status().isOk());
		// Hiệu trưởng xem được nhưng không sửa được văn bản toàn chuỗi
		as(principalA, put(doc(chainId)).contentType(MediaType.APPLICATION_JSON)
			.content("{\"title\":\"Sửa\",\"visibleRoles\":[],\"requireAck\":false}"), schoolA.getId())
			.andExpect(status().isForbidden());
	}

	@Test
	void acknowledgementRateUpdatesAndNewVersionCanRequireReack() throws Exception {
		String id = publish(principalA, schoolA.getId(), "Quy định an toàn", "[\"TEACHER\"]", true);
		// Người cần đọc: 2 giáo viên cơ sở A (không gồm y tế, giáo viên cơ sở B, hiệu trưởng)
		stats(id).andExpect(jsonPath("$.document.stats.required").value(2))
			.andExpect(jsonPath("$.document.stats.acknowledged").value(0));
		assertThat(notificationRepo.findAll().stream()
			.filter(n -> n.getUserId().equals(teacherA.getId()) && "/tai-lieu/%s".formatted(id).equals(n.getLink())))
			.hasSize(1);

		as(teacherA, get(doc(id)), schoolA.getId()).andExpect(jsonPath("$.document.myAck.required").value(true))
			.andExpect(jsonPath("$.document.myAck.acknowledgedAt").doesNotExist());
		as(teacherA, post(doc(id) + "/ack"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.document.myAck.acknowledgedAt").isNotEmpty());
		as(teacherA, post(doc(id) + "/ack"), schoolA.getId()).andExpect(status().isOk());
		stats(id).andExpect(jsonPath("$.document.stats.acknowledged").value(1));
		as(principalA, get(doc(id) + "/readers?acknowledged=false"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(1));
		// Y tế không thuộc diện đọc (không thấy văn bản), hiệu trưởng không có vai trò giáo viên
		as(nurseA, post(doc(id) + "/ack"), schoolA.getId()).andExpect(status().isNotFound());
		as(principalA, post(doc(id) + "/ack"), schoolA.getId()).andExpect(status().isForbidden());

		// Phiên bản mới không yêu cầu xác nhận lại: tỷ lệ giữ nguyên
		addVersion(id, false).andExpect(status().isCreated()).andExpect(jsonPath("$.document.currentVersionNo").value(2))
			.andExpect(jsonPath("$.document.ackVersionNo").value(1))
			.andExpect(jsonPath("$.versions.length()").value(2));
		stats(id).andExpect(jsonPath("$.document.stats.acknowledged").value(1));
		// Yêu cầu xác nhận lại: mọi người về chưa đọc
		addVersion(id, true).andExpect(jsonPath("$.document.ackVersionNo").value(3));
		stats(id).andExpect(jsonPath("$.document.stats.acknowledged").value(0));
		as(teacherA, post(doc(id) + "/ack"), schoolA.getId()).andExpect(status().isOk());
		stats(id).andExpect(jsonPath("$.document.stats.acknowledged").value(1));
	}

	@Test
	void remindOnlyUnreadReadersAtMostOncePerDay() throws Exception {
		String id = publish(principalA, schoolA.getId(), "Lịch họp tháng", "[]", true);
		as(teacherA, post(doc(id) + "/ack"), schoolA.getId()).andExpect(status().isOk());
		// Người cần đọc: hiệu trưởng, 2 giáo viên, y tế; đã đọc: teacherA
		as(principalA, post(doc(id) + "/remind"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.reminded").value(3));
		assertThat(notificationRepo.findAll().stream()
			.filter(n -> "LIBRARY_REMIND".equals(n.getType()) && ("/tai-lieu/" + id).equals(n.getLink()))
			.map(n -> n.getUserId()))
			.containsExactlyInAnyOrder(principalA.getId(), teacherA2.getId(), nurseA.getId());
		as(principalA, post(doc(id) + "/remind"), schoolA.getId()).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("REMIND_LIMIT"));
		as(teacherA, post(doc(id) + "/remind"), schoolA.getId()).andExpect(status().isForbidden());
	}

	@Test
	void foldersAreScopedAndDeletedOnlyWhenEmpty() throws Exception {
		String folderA = folder(principalA, schoolA.getId(), null, "Quy chế");
		String child = folder(principalA, null, folderA, "Nội quy lớp");
		as(principalA, post("/api/v1/library/folders").contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"quy chế\",\"schoolId\":\"%s\"}".formatted(schoolA.getId())), schoolA.getId())
			.andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].field").value("name"));

		as(teacherB, get("/api/v1/library/folders"), schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", not(hasItem(folderA))));
		as(teacherA, get("/api/v1/library/folders"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.id == '%s')].schoolId".formatted(child)).value(schoolA.getId().toString()))
			.andExpect(jsonPath("$[?(@.id == '%s')].canManage".formatted(child)).value(false));

		String fileId = uploadPdf(principalA, "nq.pdf");
		String docId = JsonPath.read(as(principalA, post("/api/v1/library/documents").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"folderId":"%s","schoolId":"%s","title":"Nội quy lớp Mầm","visibleRoles":[],"requireAck":false,"fileId":"%s"}"""
				.formatted(child, schoolA.getId(), fileId)), schoolA.getId())
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.document.id");
		as(teacherA, get("/api/v1/library/documents?folderId=" + child), schoolA.getId())
			.andExpect(jsonPath("$.items[*].id", hasItem(docId)));

		as(principalA, delete("/api/v1/library/folders/" + folderA), schoolA.getId()).andExpect(status().isConflict());
		as(principalA, delete(doc(docId)), schoolA.getId()).andExpect(status().isNoContent());
		as(principalA, delete("/api/v1/library/folders/" + child), schoolA.getId()).andExpect(status().isNoContent());
		as(principalA, delete("/api/v1/library/folders/" + folderA), schoolA.getId()).andExpect(status().isNoContent());
	}

	// ---- hỗ trợ

	private static String doc(String id) {
		return "/api/v1/library/documents/" + id;
	}

	private ResultActions stats(String id) throws Exception {
		return as(principalA, get(doc(id)), schoolA.getId()).andExpect(status().isOk());
	}

	private ResultActions createDocument(User user, UUID schoolId, String title, String roles, boolean requireAck,
			String fileId) throws Exception {
		String school = schoolId == null ? "null" : "\"" + schoolId + "\"";
		return as(user, post("/api/v1/library/documents").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolId":%s,"title":"%s","docNumber":"01/QĐ","issuedDate":"2026-09-01","visibleRoles":%s,"requireAck":%s,"fileId":"%s"}"""
			.formatted(school, title, roles, requireAck, fileId)), schoolId);
	}

	private String publish(User user, UUID schoolId, String title, String roles, boolean requireAck) throws Exception {
		String fileId = uploadPdf(user, "van-ban.pdf");
		String body = createDocument(user, schoolId, title, roles, requireAck, fileId).andExpect(status().isCreated())
			.andExpect(jsonPath("$.document.currentVersionNo").value(1))
			.andReturn().getResponse().getContentAsString();
		return JsonPath.read(body, "$.document.id");
	}

	private ResultActions addVersion(String id, boolean reack) throws Exception {
		String fileId = uploadPdf(principalA, "ban-moi.pdf");
		return as(principalA, post(doc(id) + "/versions").contentType(MediaType.APPLICATION_JSON)
			.content("{\"fileId\":\"%s\",\"note\":\"Sửa đổi\",\"requireReack\":%s}".formatted(fileId, reack)),
				schoolA.getId());
	}

	private String folder(User user, UUID schoolId, String parentId, String name) throws Exception {
		String json = parentId != null ? "{\"name\":\"%s\",\"parentId\":\"%s\"}".formatted(name, parentId)
				: "{\"name\":\"%s\",\"schoolId\":\"%s\"}".formatted(name, schoolId);
		String body = as(user, post("/api/v1/library/folders").contentType(MediaType.APPLICATION_JSON).content(json),
				schoolA.getId())
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		return JsonPath.read(body, "$.id");
	}

}
