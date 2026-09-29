package com.preschool.common.file;

import java.util.UUID;

import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileDtos.FileResponse;
import com.preschool.common.file.FileDtos.UploadUrlRequest;
import com.preschool.common.file.FileDtos.UploadUrlResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/files")
@Tag(name = "File")
public class FileController {

	private final FileService fileService;

	public FileController(FileService fileService) {
		this.fileService = fileService;
	}

	@PostMapping("/upload-url")
	@Operation(summary = "Xin link upload",
			description = "Tạo bản ghi file (PENDING) và trả link PUT có hạn. Sau khi PUT xong phải gọi complete.")
	public UploadUrlResponse uploadUrl(@Valid @RequestBody UploadUrlRequest request) {
		return fileService.createUpload(request);
	}

	@PostMapping("/{id}/complete")
	@Operation(summary = "Xác nhận đã upload",
			description = "Kiểm tra nội dung trên storage đúng loại và dung lượng; sai thì xóa file.")
	public FileResponse complete(@PathVariable UUID id) {
		return fileService.complete(id);
	}

	@GetMapping("/{id}/download-url")
	@Operation(summary = "Xin link tải file (có hạn)")
	public DownloadUrlResponse downloadUrl(@PathVariable UUID id) {
		return fileService.downloadUrl(id);
	}

}
