package com.preschool.common.file;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Cấu hình S3/MinIO ({@code app.storage.*}).
 *
 * @param endpoint địa chỉ S3 mà cả backend lẫn trình duyệt truy cập được (link ký dùng địa chỉ này)
 * @param region vùng S3 (MinIO chấp nhận giá trị bất kỳ)
 * @param accessKey khóa truy cập
 * @param secretKey khóa bí mật
 * @param bucket bucket chứa mọi file
 * @param createBucket tự tạo bucket khi khởi động (dev/test)
 * @param uploadUrlTtl thời hạn link upload
 * @param downloadUrlTtl thời hạn link tải
 * @param maxSizeBytes kích thước tối đa một file
 * @param allowedMimeTypes các loại file được phép
 * @param allowLocalEndpoint cho phép endpoint localhost (dev/test với MinIO trên máy); môi trường thật thì endpoint
 *        localhost nghĩa là quên đặt S3_ENDPOINT, link upload trình duyệt không dùng được
 */
@Validated
@ConfigurationProperties("app.storage")
public record StorageProperties(
		@NotNull URI endpoint,
		@DefaultValue("us-east-1") String region,
		@NotBlank String accessKey,
		@NotBlank String secretKey,
		@DefaultValue("preschool") String bucket,
		@DefaultValue("false") boolean createBucket,
		@DefaultValue("10m") Duration uploadUrlTtl,
		@DefaultValue("5m") Duration downloadUrlTtl,
		@DefaultValue("20971520") @Positive long maxSizeBytes,
		@DefaultValue({ "application/pdf", "image/jpeg", "image/png", "image/webp",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"application/msword" }) @NotEmpty List<String> allowedMimeTypes,
		@DefaultValue("false") boolean allowLocalEndpoint) {

	/** Endpoint còn là localhost ngoài dev/test: chưa cấu hình kho file (R2/S3). */
	public boolean misconfigured() {
		String host = endpoint.getHost();
		return !allowLocalEndpoint && (host == null || host.equals("localhost") || host.startsWith("127."));
	}

}
