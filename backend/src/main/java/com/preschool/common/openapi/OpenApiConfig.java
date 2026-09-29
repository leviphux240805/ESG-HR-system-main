package com.preschool.common.openapi;

import com.preschool.security.SchoolScope;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	public static final String BEARER = "bearerAuth";

	@Bean
	OpenAPI preschoolOpenApi() {
		return new OpenAPI()
			.info(new Info().title("Preschool Management API").version("v1")
				.description("API quản lý chuỗi trường mầm non. Lỗi trả về theo RFC 7807 (application/problem+json)."))
			.components(new Components().addSecuritySchemes(BEARER,
					new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
			.addSecurityItem(new SecurityRequirement().addList(BEARER));
	}

	/** Thêm header X-School-Id (tùy chọn) cho mọi API nghiệp vụ để client sinh type có tham số này. */
	@Bean
	OpenApiCustomizer schoolHeaderCustomizer() {
		return openApi -> {
			if (openApi.getPaths() == null) {
				return;
			}
			openApi.getPaths().forEach((path, item) -> {
				if (!path.startsWith("/api/v1/")
						|| SchoolScope.SCHOOL_AGNOSTIC_PREFIXES.stream().anyMatch(path::startsWith)) {
					return;
				}
				item.readOperations().forEach(operation -> operation.addParametersItem(new HeaderParameter()
					.name(SchoolScope.HEADER)
					.required(false)
					.description("Cơ sở đang chọn (UUID). Bỏ trống = tất cả cơ sở trong phạm vi của người dùng.")
					.schema(new StringSchema().format("uuid"))));
			});
		};
	}

}
