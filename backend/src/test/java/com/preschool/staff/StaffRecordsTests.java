package com.preschool.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;
import com.preschool.staff.entity.Staff;
import com.preschool.staff.entity.StaffEnums.Position;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/** Hợp đồng, giấy tờ, file của hồ sơ: chặn chéo cơ sở, quyền theo vai trò, phiên bản, gắn file an toàn. */
class StaffRecordsTests extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	School schoolA;

	School schoolB;

	Staff staffA;

	User principalA;

	@BeforeEach
	void setUpStaff() {
		schoolA = data.school();
		schoolB = data.school();
		staffA = data.staff(schoolA, Position.TEACHER);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
	}

	@Test
	void principalAddsContractWithFileOtherSchoolGets404() throws Exception {
		String fileId = uploadPdf(principalA, "hop-dong.pdf");

		String body = as(principalA, post("/api/v1/staff/" + staffA.getId() + "/contracts")
			.contentType(MediaType.APPLICATION_JSON)
			.content(contractJson("2026-01-01", "2026-12-31", fileId)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.file.originalName").value("hop-dong.pdf"))
			.andReturn().getResponse().getContentAsString();
		String contractId = JsonPath.read(body, "$.id");
		assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE entity = 'staff.contract' AND entity_id = ?",
				Integer.class, staffA.getId())).isEqualTo(1);

		User principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		as(principalB, get("/api/v1/staff/" + staffA.getId() + "/contracts")).andExpect(status().isNotFound());
		as(principalB, put("/api/v1/staff/" + staffA.getId() + "/contracts/" + contractId)
			.contentType(MediaType.APPLICATION_JSON).content(contractJson("2026-01-01", null, null)))
			.andExpect(status().isNotFound());
		as(principalB, get("/api/v1/staff/" + staffA.getId() + "/files/" + fileId + "/download-url"))
			.andExpect(status().isNotFound());
	}

	@Test
	void staffSeesOwnRecordsReadOnlyAndCanPreviewFile() throws Exception {
		String fileId = uploadPdf(principalA, "hop-dong.pdf");
		as(principalA, post("/api/v1/staff/" + staffA.getId() + "/contracts").contentType(MediaType.APPLICATION_JSON)
			.content(contractJson("2026-01-01", null, fileId))).andExpect(status().isCreated());
		User self = data.userForStaff(RoleCode.TEACHER, schoolA, staffA);

		as(self, get("/api/v1/staff/" + staffA.getId() + "/contracts")).andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(1));
		as(self, post("/api/v1/staff/" + staffA.getId() + "/contracts").contentType(MediaType.APPLICATION_JSON)
			.content(contractJson("2027-01-01", null, null))).andExpect(status().isForbidden());
		as(self, get("/api/v1/staff/" + staffA.getId() + "/files/" + fileId + "/download-url?inline=true"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.url", containsString("response-content-disposition=inline")));

		// Đồng nghiệp cùng cơ sở không xem được hồ sơ (và file) của người khác
		User colleague = data.userForStaff(RoleCode.TEACHER, schoolA, data.staff(schoolA, Position.NANNY));
		as(colleague, get("/api/v1/staff/" + staffA.getId() + "/files/" + fileId + "/download-url"))
			.andExpect(status().isForbidden());
	}

	@Test
	void cannotAttachFileUploadedBySomeoneElseOrUnrelatedFile() throws Exception {
		User admin = data.principal(schoolA, schoolB);
		String principalsFile = uploadPdf(principalA, "cua-hieu-truong.pdf");

		as(admin, post("/api/v1/staff/" + staffA.getId() + "/contracts").contentType(MediaType.APPLICATION_JSON)
			.content(contractJson("2026-01-01", null, principalsFile))).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FILE_FORBIDDEN"));
		// File không gắn với hồ sơ thì không lấy link qua hồ sơ được
		as(principalA, get("/api/v1/staff/" + staffA.getId() + "/files/" + principalsFile + "/download-url"))
			.andExpect(status().isNotFound());
	}

	@Test
	void documentsKeepVersionsLatestIsCurrent() throws Exception {
		String typeId = jdbc.queryForObject("SELECT id::text FROM document_types WHERE code = 'GIAY_KHAM_SUC_KHOE'",
				String.class);
		String v1 = uploadPdf(principalA, "kham-2025.pdf");
		String v2 = uploadPdf(principalA, "kham-2026.pdf");
		String url = "/api/v1/staff/" + staffA.getId() + "/documents";

		as(principalA, post(url).contentType(MediaType.APPLICATION_JSON)
			.content(docJson(typeId, v1, "2025-09-01", "2026-09-01"))).andExpect(status().isCreated());
		as(principalA, post(url).contentType(MediaType.APPLICATION_JSON)
			.content(docJson(typeId, v2, "2026-09-01", "2027-09-01"))).andExpect(status().isCreated());

		as(principalA, get(url)).andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[0].file.originalName").value("kham-2026.pdf"))
			.andExpect(jsonPath("$[0].current").value(true))
			.andExpect(jsonPath("$[0].expiryDate").value("2027-09-01"))
			.andExpect(jsonPath("$[1].current").value(false));
	}

	@Test
	void recordMustBelongToStaffInPath() throws Exception {
		Staff other = data.staff(schoolA, Position.NANNY);
		String body = as(principalA, post("/api/v1/staff/" + other.getId() + "/dependents")
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"fullName\":\"Con A\",\"relationship\":\"Con\",\"fromMonth\":\"2026-01-15\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.fromMonth").value("2026-01-01"))
			.andReturn().getResponse().getContentAsString();
		String dependentId = JsonPath.read(body, "$.id");

		as(principalA, put("/api/v1/staff/" + staffA.getId() + "/dependents/" + dependentId)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"fullName\":\"Đổi\",\"relationship\":\"Con\",\"fromMonth\":\"2026-01-01\"}"))
			.andExpect(status().isNotFound());
	}

	@Test
	void invalidDatesAreFieldErrors() throws Exception {
		as(principalA, post("/api/v1/staff/" + staffA.getId() + "/contracts").contentType(MediaType.APPLICATION_JSON)
			.content(contractJson("2026-12-31", "2026-01-01", null))).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("endDate"));
	}

	private static String contractJson(String start, String end, String fileId) {
		return """
				{"contractType":"DEFINITE","contractNo":"HĐ-1","startDate":"%s","endDate":%s,"fileId":%s}"""
			.formatted(start, end == null ? "null" : "\"" + end + "\"", fileId == null ? "null" : "\"" + fileId + "\"");
	}

	private static String docJson(String typeId, String fileId, String issued, String expiry) {
		return """
				{"documentTypeId":"%s","fileId":"%s","issuedDate":"%s","expiryDate":"%s"}"""
			.formatted(typeId, fileId, issued, expiry);
	}

}
