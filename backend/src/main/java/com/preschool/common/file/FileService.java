package com.preschool.common.file;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileDtos.FileResponse;
import com.preschool.common.file.FileDtos.UploadUrlRequest;
import com.preschool.common.file.FileDtos.UploadUrlResponse;
import com.preschool.security.SchoolScope;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

/**
 * Upload/tải file qua link ký (presigned URL): nội dung file đi thẳng giữa trình duyệt và S3/MinIO, DB chỉ lưu
 * metadata. Quy trình: upload-url (PENDING) → trình duyệt PUT → complete (kiểm tra object → READY) → download-url.
 */
@Service
public class FileService {

	private static final Logger log = LoggerFactory.getLogger(FileService.class);

	/**
	 * TODO(assumption): quyền tải file chung ở giai đoạn 1 = người upload hoặc vai trò quản lý. Từ giai đoạn 2, mỗi
	 * module (hồ sơ nhân viên, thư viện văn bản…) tự kiểm tra quyền trên bản ghi gắn file.
	 */
	private static final Set<RoleCode> MANAGER_ROLES = Set.of(RoleCode.OWNER, RoleCode.CHAIN_ADMIN, RoleCode.PRINCIPAL);

	private final StoredFileRepository files;

	private final S3Client s3;

	private final S3Presigner presigner;

	private final StorageProperties props;

	private final Clock clock;

	public FileService(StoredFileRepository files, S3Client s3, S3Presigner presigner, StorageProperties props,
			Clock clock) {
		this.files = files;
		this.s3 = s3;
		this.presigner = presigner;
		this.props = props;
		this.clock = clock;
	}

	@Transactional
	public UploadUrlResponse createUpload(UploadUrlRequest request) {
		SchoolScope scope = SchoolScope.require();
		String mimeType = request.contentType().trim().toLowerCase(Locale.ROOT);
		if (!props.allowedMimeTypes().contains(mimeType)) {
			throw ApiException.badRequest("FILE_TYPE_NOT_ALLOWED",
					"Loại file không được hỗ trợ. Chỉ nhận PDF, ảnh (JPG, PNG, WEBP), Word và Excel.");
		}
		if (request.sizeBytes() > props.maxSizeBytes()) {
			throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE",
					"File vượt quá dung lượng cho phép (" + props.maxSizeBytes() / (1024 * 1024) + " MB).");
		}
		UUID schoolId = owningSchool(scope, request.schoolId());

		String storageKey = storageKey(schoolId);
		StoredFile file = files.save(new StoredFile(schoolId, storageKey, request.fileName().trim(), mimeType,
				request.sizeBytes(), scope.userId()));

		PresignedPutObjectRequest presigned = presigner.presignPutObject(p -> p.signatureDuration(props.uploadUrlTtl())
			.putObjectRequest(o -> o.bucket(props.bucket())
				.key(storageKey)
				.contentType(mimeType)
				.contentLength(request.sizeBytes())));

		Map<String, String> headers = new LinkedHashMap<>();
		presigned.signedHeaders().forEach((name, values) -> {
			// Trình duyệt tự đặt Host và Content-Length (không được gán bằng tay)
			if (!name.equalsIgnoreCase("host") && !name.equalsIgnoreCase("content-length")) {
				headers.put(name, String.join(",", values));
			}
		});
		return new UploadUrlResponse(FileResponse.of(file), presigned.url().toString(),
				presigned.httpRequest().method().name(), headers, presigned.expiration());
	}

	/**
	 * Xác nhận đã upload: object phải tồn tại, đúng kích thước và đúng loại (kiểm tra magic bytes). Sai thì xóa cả
	 * object lẫn bản ghi để người dùng upload lại.
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public FileResponse complete(UUID fileId) {
		SchoolScope scope = SchoolScope.require();
		StoredFile file = find(fileId);
		if (!file.getUploadedBy().equals(scope.userId())) {
			throw ApiException.forbidden("FILE_NOT_OWNER", "Chỉ người tải file lên mới được xác nhận file.");
		}
		if (file.getStatus() == StoredFile.Status.READY) {
			return FileResponse.of(file);
		}

		HeadObjectResponse head;
		try {
			head = s3.headObject(h -> h.bucket(props.bucket()).key(file.getStorageKey()));
		}
		catch (NoSuchKeyException ex) {
			throw ApiException.badRequest("FILE_NOT_UPLOADED", "Chưa nhận được nội dung file, vui lòng tải lên lại.");
		}
		catch (S3Exception ex) {
			if (ex.statusCode() == 404) {
				throw ApiException.badRequest("FILE_NOT_UPLOADED",
						"Chưa nhận được nội dung file, vui lòng tải lên lại.");
			}
			throw ex;
		}

		boolean sizeOk = head.contentLength() != null && head.contentLength() == file.getSizeBytes();
		boolean typeOk = sizeOk && FileSignatures.matches(file.getMimeType(), readHead(file));
		if (!sizeOk || !typeOk) {
			discard(file);
			throw ApiException.badRequest("FILE_INVALID",
					"Nội dung file không khớp với loại hoặc dung lượng đã khai báo. Vui lòng chọn lại file.");
		}
		file.markReady();
		return FileResponse.of(file);
	}

	@Transactional(readOnly = true)
	public DownloadUrlResponse downloadUrl(UUID fileId) {
		SchoolScope scope = SchoolScope.require();
		StoredFile file = find(fileId);
		boolean allowed = file.getUploadedBy().equals(scope.userId())
				|| MANAGER_ROLES.stream().anyMatch(scope::hasRole);
		if (!allowed) {
			throw ApiException.forbidden("FILE_FORBIDDEN", "Bạn không có quyền tải file này.");
		}
		if (file.getStatus() != StoredFile.Status.READY) {
			throw ApiException.conflict("FILE_NOT_READY", "File chưa tải lên xong.");
		}
		String disposition = ContentDisposition.attachment()
			.filename(file.getOriginalName(), StandardCharsets.UTF_8)
			.build()
			.toString();
		PresignedGetObjectRequest presigned = presigner
			.presignGetObject(p -> p.signatureDuration(props.downloadUrlTtl())
				.getObjectRequest(o -> o.bucket(props.bucket())
					.key(file.getStorageKey())
					.responseContentDisposition(disposition)
					.responseContentType(file.getMimeType())));
		return new DownloadUrlResponse(presigned.url().toString(), presigned.expiration());
	}

	/** File của cơ sở khác đã bị Hibernate filter loại khỏi truy vấn nên trả 404 như không tồn tại. */
	private StoredFile find(UUID fileId) {
		return files.findById(fileId).orElseThrow(() -> ApiException.notFound("Không tìm thấy file."));
	}

	/**
	 * Cơ sở sở hữu file: theo yêu cầu, không có thì theo cơ sở đang chọn; vai trò cấp chuỗi chọn "Tất cả cơ sở"
	 * thì file dùng chung toàn chuỗi (school_id rỗng).
	 */
	private static UUID owningSchool(SchoolScope scope, UUID requested) {
		if (requested != null) {
			if (!scope.canAccessSchool(requested)) {
				throw ApiException.forbidden("SCHOOL_FORBIDDEN", "Bạn không có quyền truy cập cơ sở này.");
			}
			return requested;
		}
		if (scope.selectedSchoolId() != null) {
			return scope.selectedSchoolId();
		}
		if (scope.access().chainWide()) {
			return null;
		}
		Set<UUID> schools = scope.effectiveSchoolIds();
		if (schools.size() == 1) {
			return schools.iterator().next();
		}
		throw ApiException.badRequest("SCHOOL_REQUIRED", "Vui lòng chọn cơ sở cho file.");
	}

	private String storageKey(UUID schoolId) {
		LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
		String prefix = schoolId == null ? "chain" : schoolId.toString();
		return "%s/%d/%02d/%s".formatted(prefix, today.getYear(), today.getMonthValue(), UUID.randomUUID());
	}

	private byte[] readHead(StoredFile file) {
		ResponseBytes<GetObjectResponse> bytes = s3.getObjectAsBytes(g -> g.bucket(props.bucket())
			.key(file.getStorageKey())
			.range("bytes=0-" + (FileSignatures.PROBE_LENGTH - 1)));
		return bytes.asByteArray();
	}

	private void discard(StoredFile file) {
		try {
			s3.deleteObject(d -> d.bucket(props.bucket()).key(file.getStorageKey()));
		}
		catch (S3Exception ex) {
			log.warn("Không xóa được object {}: {}", file.getStorageKey(), ex.getMessage());
		}
		files.delete(file);
	}

}
