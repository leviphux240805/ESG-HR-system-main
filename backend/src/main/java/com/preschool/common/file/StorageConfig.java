package com.preschool.common.file;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {

	private static final Logger log = LoggerFactory.getLogger(StorageConfig.class);

	@Bean(destroyMethod = "close")
	S3Client s3Client(StorageProperties props) {
		return S3Client.builder()
			.endpointOverride(props.endpoint())
			.region(Region.of(props.region()))
			.credentialsProvider(credentials(props))
			.forcePathStyle(true)
			// MinIO và link ký gửi từ trình duyệt không kèm checksum mặc định của SDK mới
			.requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
			.responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
			.build();
	}

	@Bean(destroyMethod = "close")
	S3Presigner s3Presigner(StorageProperties props) {
		return S3Presigner.builder()
			.endpointOverride(props.endpoint())
			.region(Region.of(props.region()))
			.credentialsProvider(credentials(props))
			.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
			.build();
	}

	/** Dev/test: tạo bucket nếu chưa có. Môi trường thật tạo bucket bằng hạ tầng, không bật cờ này. */
	@Bean
	ApplicationRunner createBucketIfMissing(StorageProperties props, S3Client s3) {
		return args -> {
			if (!props.createBucket()) {
				return;
			}
			try {
				s3.headBucket(b -> b.bucket(props.bucket()));
			}
			catch (S3Exception ex) {
				if (ex.statusCode() != 404) {
					throw ex;
				}
				try {
					s3.createBucket(b -> b.bucket(props.bucket()));
					log.info("Đã tạo bucket {}", props.bucket());
				}
				catch (BucketAlreadyOwnedByYouException ignored) {
					// tạo song song bởi instance khác
				}
			}
		};
	}

	private static StaticCredentialsProvider credentials(StorageProperties props) {
		return StaticCredentialsProvider.create(AwsBasicCredentials.create(props.accessKey(), props.secretKey()));
	}

}
