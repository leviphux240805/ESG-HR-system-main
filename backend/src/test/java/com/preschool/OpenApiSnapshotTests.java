package com.preschool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ghi đặc tả OpenAPI ra {@code frontend/openapi.json} mỗi lần chạy test, để frontend sinh type
 * ({@code npm run gen:api}) mà không cần backend đang chạy. Commit file này cùng thay đổi API.
 */
class OpenApiSnapshotTests extends ApiTestSupport {

	static final Path SNAPSHOT = Path.of("..", "frontend", "openapi.json");

	@Autowired
	JsonMapper jsonMapper;

	@Test
	void writeSnapshotForFrontend() throws Exception {
		String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse()
			.getContentAsString(StandardCharsets.UTF_8);
		JsonNode spec = jsonMapper.readTree(json);
		assertThat(spec.path("paths").has("/api/v1/auth/login")).isTrue();
		assertThat(spec.path("paths").has("/api/v1/files/upload-url")).isTrue();

		String pretty = jsonMapper.writer().with(SerializationFeature.INDENT_OUTPUT).writeValueAsString(spec) + "\n";
		Files.writeString(SNAPSHOT, pretty.replace("\r\n", "\n"), StandardCharsets.UTF_8);
	}

}
