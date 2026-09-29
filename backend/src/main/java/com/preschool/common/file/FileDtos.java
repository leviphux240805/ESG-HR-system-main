package com.preschool.common.file;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** DTO của API file. */
public final class FileDtos {

	private FileDtos() {
	}

	public record UploadUrlRequest(
			@Schema(example = "hop-dong.pdf") @NotBlank @Size(max = 255) String fileName,
			@Schema(example = "application/pdf") @NotBlank @Size(max = 100) String contentType,
			@Schema(description = "Kích thước file (byte)") @NotNull @Positive Long sizeBytes,
			@Schema(description = "Cơ sở sở hữu file; bỏ trống = cơ sở đang chọn (hoặc toàn chuỗi nếu đang chọn "
					+ "\"Tất cả cơ sở\")") UUID schoolId) {
	}

	public record UploadUrlResponse(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) FileResponse file,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Link PUT nội dung file lên storage")
			String uploadUrl,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "PUT") String method,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Header bắt buộc gửi kèm khi PUT") Map<String, String> headers,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant expiresAt) {
	}

	public record DownloadUrlResponse(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String url,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant expiresAt) {
	}

	public record FileResponse(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = dùng chung toàn chuỗi") UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String originalName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String mimeType,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) StoredFile.Status status) {

		static FileResponse of(StoredFile f) {
			return new FileResponse(f.getId(), f.getSchoolId(), f.getOriginalName(), f.getMimeType(), f.getSizeBytes(),
					f.getStatus());
		}

	}

}
