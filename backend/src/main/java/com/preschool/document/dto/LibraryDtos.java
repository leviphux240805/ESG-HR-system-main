package com.preschool.document.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.staff.dto.StaffRecordDtos.FileRef;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTO thư viện văn bản. */
public final class LibraryDtos {

	private LibraryDtos() {
	}

	// ---- thư mục

	public record FolderDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(description = "Rỗng = thư mục dùng chung trong tổ chức") UUID schoolId,
			UUID parentId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Người xem được tạo thư mục con, đổi tên, xóa, thêm văn bản") boolean canManage) {
	}

	public record CreateFolderRequest(@NotBlank @Size(max = 200) String name,
			@Schema(description = "Thư mục cha; thư mục con cùng cơ sở với cha") UUID parentId,
			@Schema(description = "Bỏ trống = cả tổ chức (chỉ hiệu trưởng); bỏ qua khi có parentId") UUID schoolId) {
	}

	public record RenameFolderRequest(@NotBlank @Size(max = 200) String name) {
	}

	// ---- văn bản

	public record AckStats(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số người cần đọc") long required,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số người đã xác nhận") long acknowledged) {
	}

	/** Trạng thái xác nhận của chính người đang xem. */
	public record MyAck(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Người xem thuộc diện phải xác nhận văn bản này") boolean required,
			@Schema(description = "Đã xác nhận phiên bản cần đọc lúc; rỗng = chưa") Instant acknowledgedAt) {
	}

	public record DocumentItem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			UUID folderId,
			@Schema(description = "Rỗng = cả tổ chức") UUID schoolId,
			@Schema(description = "Rỗng = cả tổ chức") String schoolName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			String docNumber, LocalDate issuedDate, LocalDate effectiveTo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Rỗng = mọi vai trò") List<RoleCode> visibleRoles,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean requireAck,
			Integer ackVersionNo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int currentVersionNo,
			@Schema(description = "Chỉ có với người quản lý văn bản khi yêu cầu xác nhận") AckStats stats,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) MyAck myAck,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean canManage,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
	}

	public record VersionDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int versionNo,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) FileRef file,
			String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			String createdByName) {
	}

	public record DocumentDetail(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) DocumentItem document,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Mới nhất trước") List<VersionDto> versions,
			String folderName,
			Instant lastRemindedAt) {
	}

	public record CreateDocumentRequest(
			UUID folderId,
			@Schema(description = "Bỏ trống = cả tổ chức (chỉ hiệu trưởng)") UUID schoolId,
			@NotBlank @Size(max = 300) String title,
			@Size(max = 50) String docNumber, LocalDate issuedDate, LocalDate effectiveTo,
			@Schema(description = "Bỏ trống = mọi vai trò") List<RoleCode> visibleRoles,
			boolean requireAck,
			@NotNull UUID fileId,
			@Size(max = 500) String note) {
	}

	/** Sửa thông tin văn bản (không đổi phạm vi cơ sở; tệp đổi bằng phiên bản mới). */
	public record UpdateDocumentRequest(
			UUID folderId,
			@NotBlank @Size(max = 300) String title,
			@Size(max = 50) String docNumber, LocalDate issuedDate, LocalDate effectiveTo,
			List<RoleCode> visibleRoles,
			boolean requireAck) {
	}

	public record NewVersionRequest(@NotNull UUID fileId, @Size(max = 500) String note,
			@Schema(description = "Người đọc phải xác nhận lại phiên bản này (khi văn bản yêu cầu xác nhận)") boolean requireReack) {
	}

	public record ReaderDto(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID staffId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String staffCode,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID schoolId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String schoolName,
			@Schema(description = "Rỗng = chưa xác nhận") Instant acknowledgedAt) {
	}

	public record RemindResponse(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Số người chưa đọc được nhắc") int reminded) {
	}

}
