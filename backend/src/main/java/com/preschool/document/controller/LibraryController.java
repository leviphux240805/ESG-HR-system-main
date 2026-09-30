package com.preschool.document.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.web.PageResponse;
import com.preschool.document.dto.LibraryDtos.CreateDocumentRequest;
import com.preschool.document.dto.LibraryDtos.CreateFolderRequest;
import com.preschool.document.dto.LibraryDtos.DocumentDetail;
import com.preschool.document.dto.LibraryDtos.DocumentItem;
import com.preschool.document.dto.LibraryDtos.FolderDto;
import com.preschool.document.dto.LibraryDtos.NewVersionRequest;
import com.preschool.document.dto.LibraryDtos.ReaderDto;
import com.preschool.document.dto.LibraryDtos.RemindResponse;
import com.preschool.document.dto.LibraryDtos.RenameFolderRequest;
import com.preschool.document.dto.LibraryDtos.UpdateDocumentRequest;
import com.preschool.document.service.LibraryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Thư viện văn bản của chuỗi/cơ sở. */
@RestController
@RequestMapping("/api/v1/library")
@Tag(name = "Tài liệu")
public class LibraryController {

	private final LibraryService library;

	public LibraryController(LibraryService library) {
		this.library = library;
	}

	// ---- thư mục

	@GetMapping("/folders")
	@Operation(summary = "Thư mục: dùng chung toàn chuỗi + của các cơ sở đang chọn (danh sách phẳng, dựng cây theo parentId)")
	public List<FolderDto> folders() {
		return library.folders();
	}

	@PostMapping("/folders")
	@ResponseStatus(HttpStatus.CREATED)
	public FolderDto createFolder(@Valid @RequestBody CreateFolderRequest request) {
		return library.createFolder(request);
	}

	@PutMapping("/folders/{id}")
	public FolderDto renameFolder(@PathVariable UUID id, @Valid @RequestBody RenameFolderRequest request) {
		return library.renameFolder(id, request.name());
	}

	@DeleteMapping("/folders/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa thư mục rỗng")
	public void deleteFolder(@PathVariable UUID id) {
		library.deleteFolder(id);
	}

	// ---- văn bản

	@GetMapping("/documents")
	@Operation(summary = "Văn bản được xem (theo cơ sở đang chọn và vai trò)",
			description = "Sắp xếp: issuedDate, title, createdAt, docNumber (mặc định ngày ban hành mới nhất).")
	public PageResponse<DocumentItem> documents(@RequestParam(required = false) UUID folderId,
			@Parameter(description = "Chỉ văn bản chưa xếp thư mục") @RequestParam(defaultValue = "false") boolean unfiled,
			@Parameter(description = "Tìm theo tiêu đề, số hiệu") @RequestParam(required = false) String q,
			@ParameterObject Pageable pageable) {
		return library.list(folderId, unfiled, q, pageable);
	}

	@PostMapping("/documents")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Ban hành văn bản (phiên bản 1)")
	public DocumentDetail create(@Valid @RequestBody CreateDocumentRequest request) {
		return library.create(request);
	}

	@GetMapping("/documents/{id}")
	public DocumentDetail get(@PathVariable UUID id) {
		return library.get(id);
	}

	@PutMapping("/documents/{id}")
	public DocumentDetail update(@PathVariable UUID id, @Valid @RequestBody UpdateDocumentRequest request) {
		return library.update(id, request);
	}

	@DeleteMapping("/documents/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable UUID id) {
		library.delete(id);
	}

	@PostMapping("/documents/{id}/versions")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Tải phiên bản mới (tùy chọn yêu cầu xác nhận lại)")
	public DocumentDetail addVersion(@PathVariable UUID id, @Valid @RequestBody NewVersionRequest request) {
		return library.addVersion(id, request);
	}

	@PostMapping("/documents/{id}/ack")
	@Operation(summary = "Tôi đã đọc: xác nhận phiên bản hiện tại")
	public DocumentDetail acknowledge(@PathVariable UUID id) {
		return library.acknowledge(id);
	}

	@GetMapping("/documents/{id}/readers")
	@Operation(summary = "Người cần đọc và trạng thái xác nhận (người quản lý văn bản)")
	public List<ReaderDto> readers(@PathVariable UUID id,
			@Parameter(description = "true = đã đọc, false = chưa đọc, bỏ trống = tất cả") @RequestParam(required = false) Boolean acknowledged) {
		return library.readers(id, acknowledged);
	}

	@PostMapping("/documents/{id}/remind")
	@Operation(summary = "Nhắc người chưa đọc (thông báo + email, tối đa 1 lần/ngày)")
	public RemindResponse remind(@PathVariable UUID id) {
		return library.remind(id);
	}

	@GetMapping("/documents/{id}/versions/{versionNo}/download-url")
	@Operation(summary = "Link tải/xem phiên bản", description = "inline=true để xem trước PDF/ảnh trong trình duyệt.")
	public DownloadUrlResponse fileUrl(@PathVariable UUID id, @PathVariable int versionNo,
			@RequestParam(defaultValue = "false") boolean inline) {
		return library.fileUrl(id, versionNo, inline);
	}

}
