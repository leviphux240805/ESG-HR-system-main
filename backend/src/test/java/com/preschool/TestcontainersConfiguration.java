package com.preschool;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	/** Cùng phiên bản với docker-compose.yml. */
	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
	}

	/** Cùng image với docker-compose.yml (MinIO ngừng phát hành image community). */
	@Bean
	MinIOContainer minioContainer() {
		return new MinIOContainer(DockerImageName.parse("chainguard/minio:latest").asCompatibleSubstituteFor("minio/minio"));
	}

	@Bean
	DynamicPropertyRegistrar storageProperties(MinIOContainer minio) {
		return registry -> {
			registry.add("app.storage.endpoint", minio::getS3URL);
			registry.add("app.storage.access-key", minio::getUserName);
			registry.add("app.storage.secret-key", minio::getPassword);
		};
	}

}
