package com.preschool.common.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.school.entity.School;
import com.preschool.security.SchoolScope;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

class FileTests extends ApiTestSupport {

	private static final byte[] PDF = "%PDF-1.7\nnoi dung thu\n%%EOF".getBytes(StandardCharsets.US_ASCII);

	private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0 };

	private final HttpClient http = HttpClient.newHttpClient();

	School schoolA;

	School schoolB;

	@BeforeEach
	void setUpSchools() {
		schoolA = data.school();
		schoolB = data.school();
	}

	@Test
	void uploadCompleteAndDownload() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);

		String body = requestUpload(teacher, null, "Hợp đồng lao động.pdf", "application/pdf", PDF.length)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.file.status").value("PENDING"))
			.andExpect(jsonPath("$.file.schoolId").value(schoolA.getId().toString()))
			.andExpect(jsonPath("$.method").value("PUT"))
			.andReturn().getResponse().getContentAsString();
		String fileId = JsonPath.read(body, "$.file.id");

		assertThat(put(body, PDF)).isEqualTo(200);
		call(teacher, post("/api/v1/files/" + fileId + "/complete"), null).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("READY"));

		String url = JsonPath.read(call(teacher, get("/api/v1/files/" + fileId + "/download-url"), null)
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.url");
		HttpResponse<byte[]> download = http.send(HttpRequest.newBuilder(URI.create(url)).build(),
				HttpResponse.BodyHandlers.ofByteArray());
		assertThat(download.statusCode()).isEqualTo(200);
		assertThat(download.body()).isEqualTo(PDF);
		assertThat(download.headers().firstValue("Content-Disposition")).get().asString()
			.contains("attachment").contains("UTF-8''H%E1%BB%A3p");
	}

	@Test
	void otherSchoolCannotSeeFile() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);
		String fileId = uploadReady(teacherA, PDF);
		User principalB = data.user(RoleCode.PRINCIPAL, schoolB);
		User owner = data.user(RoleCode.OWNER, null);

		call(principalB, get("/api/v1/files/" + fileId + "/download-url"), null).andExpect(status().isNotFound());
		call(principalB, post("/api/v1/files/" + fileId + "/complete"), null).andExpect(status().isNotFound());
		call(principalB, get("/api/v1/files/" + fileId + "/download-url"), schoolA.getId())
			.andExpect(status().isForbidden());
		// Chủ chuỗi chọn cơ sở B thì không thấy file cơ sở A; chọn "Tất cả" thì thấy
		call(owner, get("/api/v1/files/" + fileId + "/download-url"), schoolB.getId()).andExpect(status().isNotFound());
		call(owner, get("/api/v1/files/" + fileId + "/download-url"), null).andExpect(status().isOk());
	}

	@Test
	void onlyUploaderOrManagerCanDownloadWithinSchool() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);
		String fileId = uploadReady(teacherA, PDF);
		User otherTeacherA = data.user(RoleCode.TEACHER, schoolA);
		User principalA = data.user(RoleCode.PRINCIPAL, schoolA);

		call(otherTeacherA, get("/api/v1/files/" + fileId + "/download-url"), null).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FILE_FORBIDDEN"));
		call(otherTeacherA, post("/api/v1/files/" + fileId + "/complete"), null).andExpect(status().isForbidden());
		call(principalA, get("/api/v1/files/" + fileId + "/download-url"), null).andExpect(status().isOk());
	}

	@Test
	void contentNotMatchingDeclaredTypeIsRejectedAndRemoved() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);
		String body = requestUpload(teacher, null, "anh-doi-duoi.pdf", "application/pdf", PNG.length)
			.andReturn().getResponse().getContentAsString();
		String fileId = JsonPath.read(body, "$.file.id");
		assertThat(put(body, PNG)).isEqualTo(200);

		call(teacher, post("/api/v1/files/" + fileId + "/complete"), null).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("FILE_INVALID"));
		call(teacher, get("/api/v1/files/" + fileId + "/download-url"), null).andExpect(status().isNotFound());
	}

	@Test
	void uploadWithDifferentSizeIsRefusedByStorage() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);
		String body = requestUpload(teacher, null, "a.pdf", "application/pdf", PDF.length + 100)
			.andReturn().getResponse().getContentAsString();
		String fileId = JsonPath.read(body, "$.file.id");

		assertThat(put(body, PDF)).isNotEqualTo(200);
		call(teacher, post("/api/v1/files/" + fileId + "/complete"), null).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("FILE_NOT_UPLOADED"));
	}

	@Test
	void pendingFileCannotBeDownloaded() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);
		String fileId = JsonPath.read(requestUpload(teacher, null, "a.pdf", "application/pdf", PDF.length)
			.andReturn().getResponse().getContentAsString(), "$.file.id");

		call(teacher, get("/api/v1/files/" + fileId + "/download-url"), null).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("FILE_NOT_READY"));
	}

	@Test
	void typeAndSizeLimitsAreEnforced() throws Exception {
		User teacher = data.user(RoleCode.TEACHER, schoolA);

		requestUpload(teacher, null, "virus.exe", "application/x-msdownload", 10).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("FILE_TYPE_NOT_ALLOWED"));
		requestUpload(teacher, null, "to.pdf", "application/pdf", 2 * 1024 * 1024)
			.andExpect(status().is(413))
			.andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
	}

	@Test
	void schoolOfFileFollowsScope() throws Exception {
		User teacherA = data.user(RoleCode.TEACHER, schoolA);
		User owner = data.user(RoleCode.OWNER, null);

		requestUpload(teacherA, schoolB.getId(), "a.pdf", "application/pdf", PDF.length)
			.andExpect(status().isForbidden());
		requestUploadWithHeader(owner, schoolB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.file.schoolId").value(schoolB.getId().toString()));
		requestUpload(owner, null, "a.pdf", "application/pdf", PDF.length).andExpect(status().isOk())
			.andExpect(jsonPath("$.file.schoolId").doesNotExist());
	}

	private String uploadReady(User user, byte[] content) throws Exception {
		String body = requestUpload(user, null, "tai-lieu.pdf", "application/pdf", content.length)
			.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		assertThat(put(body, content)).isEqualTo(200);
		String fileId = JsonPath.read(body, "$.file.id");
		call(user, post("/api/v1/files/" + fileId + "/complete"), null).andExpect(status().isOk());
		return fileId;
	}

	private ResultActions requestUpload(User user, UUID schoolId, String name, String type, long size)
			throws Exception {
		String json = """
				{"fileName":"%s","contentType":"%s","sizeBytes":%d%s}"""
			.formatted(name, type, size, schoolId == null ? "" : ",\"schoolId\":\"" + schoolId + "\"");
		return call(user, post("/api/v1/files/upload-url").contentType(MediaType.APPLICATION_JSON).content(json), null);
	}

	private ResultActions requestUploadWithHeader(User user, UUID selectedSchool) throws Exception {
		return call(user, post("/api/v1/files/upload-url").contentType(MediaType.APPLICATION_JSON)
			.content("{\"fileName\":\"a.pdf\",\"contentType\":\"application/pdf\",\"sizeBytes\":%d}"
				.formatted(PDF.length)), selectedSchool);
	}

	private ResultActions call(User user, MockHttpServletRequestBuilder request, UUID selectedSchool)
			throws Exception {
		request.header(HttpHeaders.AUTHORIZATION, bearer(user));
		if (selectedSchool != null) {
			request.header(SchoolScope.HEADER, selectedSchool.toString());
		}
		return mvc.perform(request);
	}

	/** PUT nội dung lên link ký như trình duyệt; trả mã HTTP của storage. */
	private int put(String uploadResponse, byte[] content) throws Exception {
		HttpRequest.Builder builder = HttpRequest
			.newBuilder(URI.create(JsonPath.read(uploadResponse, "$.uploadUrl")))
			.PUT(HttpRequest.BodyPublishers.ofByteArray(content));
		Map<String, String> headers = JsonPath.read(uploadResponse, "$.headers");
		headers.forEach(builder::header);
		return http.send(builder.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
	}

}
