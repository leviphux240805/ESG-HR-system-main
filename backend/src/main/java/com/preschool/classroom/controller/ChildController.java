package com.preschool.classroom.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.classroom.dto.ChildDtos.ChildDetail;
import com.preschool.classroom.dto.ChildDtos.ChildDocumentDto;
import com.preschool.classroom.dto.ChildDtos.ChildDocumentRequest;
import com.preschool.classroom.dto.ChildDtos.ChildItem;
import com.preschool.classroom.dto.ChildDtos.ChildProfileRequest;
import com.preschool.classroom.dto.ChildDtos.ChildQuery;
import com.preschool.classroom.dto.ChildDtos.ChildStatusRequest;
import com.preschool.classroom.dto.ChildDtos.CreateChildRequest;
import com.preschool.classroom.dto.ChildDtos.GuardianDto;
import com.preschool.classroom.dto.ChildDtos.GuardianMatch;
import com.preschool.classroom.dto.ChildDtos.GuardianRequest;
import com.preschool.classroom.dto.ChildDtos.TransferRequest;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.ClassEnums.Gender;
import com.preschool.classroom.service.ChildService;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.web.PageResponse;

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

/** Hồ sơ trẻ, phụ huynh, giấy tờ, xếp lớp. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Hồ sơ trẻ")
public class ChildController {

	private final ChildService children;

	public ChildController(ChildService children) {
		this.children = children;
	}

	@GetMapping("/children")
	@Operation(summary = "Danh sách trẻ (giáo viên chỉ thấy trẻ lớp mình)")
	public PageResponse<ChildItem> list(@Parameter(description = "Tìm theo tên, tên ở nhà, mã trẻ")
	@RequestParam(required = false) String q, @RequestParam(required = false) UUID classId,
			@RequestParam(required = false) ChildStatus status, @RequestParam(required = false) Gender gender,
			@ParameterObject Pageable pageable) {
		return children.list(new ChildQuery(q, classId, status, gender), pageable);
	}

	@PostMapping("/children")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Nhập học: hồ sơ, xếp lớp, phụ huynh (cơ sở đang chọn)")
	public ChildDetail create(@Valid @RequestBody CreateChildRequest request) {
		return children.create(request);
	}

	@GetMapping("/children/{id}")
	@Operation(summary = "Hồ sơ trẻ: thông tin, phụ huynh, lịch sử lớp, giấy tờ")
	public ChildDetail detail(@PathVariable UUID id) {
		return children.detail(id);
	}

	@PutMapping("/children/{id}")
	@Operation(summary = "Sửa thông tin hồ sơ trẻ")
	public ChildDetail update(@PathVariable UUID id, @Valid @RequestBody ChildProfileRequest request) {
		return children.update(id, request);
	}

	@DeleteMapping("/children/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa hồ sơ nhập nhầm (xóa mềm)")
	public void delete(@PathVariable UUID id) {
		children.delete(id);
	}

	@PostMapping("/children/{id}/status")
	@Operation(summary = "Đổi trạng thái: đang học, bảo lưu, nghỉ học, hoàn thành")
	public ChildDetail changeStatus(@PathVariable UUID id, @Valid @RequestBody ChildStatusRequest request) {
		return children.changeStatus(id, request);
	}

	@PostMapping("/children/{id}/transfer")
	@Operation(summary = "Xếp lớp hoặc chuyển lớp (giữ lịch sử)")
	public ChildDetail transfer(@PathVariable UUID id, @Valid @RequestBody TransferRequest request) {
		return children.transfer(id, request);
	}

	@GetMapping("/guardians")
	@Operation(summary = "Tìm phụ huynh đã có trong cơ sở theo số điện thoại")
	public List<GuardianMatch> searchGuardians(@RequestParam String phone) {
		return children.searchGuardians(phone);
	}

	@PostMapping("/children/{id}/guardians")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm phụ huynh hoặc người đón (mới hoặc đã có trong cơ sở)")
	public List<GuardianDto> addGuardian(@PathVariable UUID id, @Valid @RequestBody GuardianRequest request) {
		return children.addGuardian(id, request);
	}

	@PutMapping("/children/{id}/guardians/{linkId}")
	@Operation(summary = "Sửa phụ huynh hoặc người đón")
	public List<GuardianDto> updateGuardian(@PathVariable UUID id, @PathVariable UUID linkId,
			@Valid @RequestBody GuardianRequest request) {
		return children.updateGuardian(id, linkId, request);
	}

	@DeleteMapping("/children/{id}/guardians/{linkId}")
	@Operation(summary = "Bỏ phụ huynh khỏi hồ sơ trẻ")
	public List<GuardianDto> removeGuardian(@PathVariable UUID id, @PathVariable UUID linkId) {
		return children.removeGuardian(id, linkId);
	}

	@PostMapping("/children/{id}/documents")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm giấy tờ của trẻ")
	public ChildDocumentDto addDocument(@PathVariable UUID id, @Valid @RequestBody ChildDocumentRequest request) {
		return children.addDocument(id, request);
	}

	@DeleteMapping("/children/{id}/documents/{documentId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa giấy tờ của trẻ")
	public void deleteDocument(@PathVariable UUID id, @PathVariable UUID documentId) {
		children.deleteDocument(id, documentId);
	}

	@GetMapping("/children/{id}/files/{fileId}/url")
	@Operation(summary = "Link xem/tải ảnh hoặc giấy tờ của trẻ")
	public DownloadUrlResponse fileUrl(@PathVariable UUID id, @PathVariable UUID fileId,
			@RequestParam(defaultValue = "false") boolean inline) {
		return children.fileUrl(id, fileId, inline);
	}

}
