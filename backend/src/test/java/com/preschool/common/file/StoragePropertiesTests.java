package com.preschool.common.file;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

class StoragePropertiesTests {

	static StorageProperties props(String endpoint, boolean allowLocal) {
		return new StorageProperties(URI.create(endpoint), "auto", "k", "s", "preschool", false, Duration.ofMinutes(10),
				Duration.ofMinutes(5), 1024, List.of("application/pdf"), allowLocal);
	}

	@Test
	void localhostEndpointOutsideDevMeansStorageIsNotConfigured() {
		assertThat(props("http://localhost:9000", false).misconfigured()).isTrue();
		assertThat(props("http://127.0.0.1:9000", false).misconfigured()).isTrue();
		assertThat(props("http://localhost:9000", true).misconfigured()).isFalse();
		assertThat(props("https://abc123.r2.cloudflarestorage.com", false).misconfigured()).isFalse();
	}

}
