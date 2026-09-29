package com.preschool.common.openapi;

import java.util.List;

import com.preschool.security.SchoolScope;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	public static final String BEARER = "bearerAuth";

	private static final String PROBLEM = "Problem";

	@Bean
	OpenAPI preschoolOpenApi() {
		return new OpenAPI()
			.info(new Info().title("Preschool Management API").version("v1")
				.description("API quản lý chuỗi trường mầm non. Lỗi trả về theo RFC 7807 (application/problem+json)."))
			// Đường dẫn tương đối: frontend gọi qua proxy cùng origin, snapshot không phụ thuộc máy chạy
			.servers(List.of(new Server().url("/")))
			.components(new Components()
				.addSecuritySchemes(BEARER,
						new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT"))
				.addSchemas(PROBLEM, problemSchema()))
			.addSecurityItem(new SecurityRequirement().addList(BEARER));
	}

	/**
	 * Mọi API nghiệp vụ: thêm header X-School-Id (tùy chọn) và response lỗi mặc định dạng Problem, để client sinh
	 * type có đủ tham số và kiểu lỗi.
	 */
	@Bean
	OpenApiCustomizer commonOperationCustomizer() {
		return openApi -> {
			if (openApi.getPaths() == null) {
				return;
			}
			openApi.getPaths().forEach((path, item) -> item.readOperations().forEach(operation -> {
				operation.getResponses().addApiResponse("default", problemResponse());
				if (path.startsWith("/api/v1/")
						&& SchoolScope.SCHOOL_AGNOSTIC_PREFIXES.stream().noneMatch(path::startsWith)) {
					operation.addParametersItem(new HeaderParameter()
						.name(SchoolScope.HEADER)
						.required(false)
						.description("Cơ sở đang chọn (UUID). Bỏ trống = tất cả cơ sở trong phạm vi của người dùng.")
						.schema(new StringSchema().format("uuid")));
				}
			}));
		};
	}

	private static ApiResponse problemResponse() {
		return new ApiResponse().description("Lỗi (RFC 7807, thông điệp tiếng Việt)")
			.content(new Content().addMediaType("application/problem+json",
					new MediaType().schema(new Schema<>().$ref("#/components/schemas/" + PROBLEM))));
	}

	@SuppressWarnings("rawtypes")
	private static Schema problemSchema() {
		Schema<?> fieldError = new ObjectSchema()
			.addProperty("field", new StringSchema())
			.addProperty("message", new StringSchema())
			.required(List.of("field", "message"));
		return new ObjectSchema()
			.description("Lỗi theo RFC 7807")
			.addProperty("type", new StringSchema())
			.addProperty("title", new StringSchema().description("Tiêu đề tiếng Việt theo mã HTTP"))
			.addProperty("status", new IntegerSchema())
			.addProperty("detail", new StringSchema().description("Thông điệp tiếng Việt hiển thị cho người dùng"))
			.addProperty("instance", new StringSchema())
			.addProperty("code", new StringSchema().description("Mã lỗi máy đọc, ví dụ INVALID_CREDENTIALS"))
			.addProperty("errors", new ArraySchema().items(fieldError).description("Lỗi từng trường khi dữ liệu không hợp lệ"))
			.required(List.of("title", "status"));
	}

}
