package com.preschool.staff.controller;

import java.util.List;

import com.preschool.staff.dto.ChangeRequestDtos.ChangeRequestDto;
import com.preschool.staff.dto.ChangeRequestDtos.SubmitChangeRequest;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.service.StaffChangeRequestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Hồ sơ của tôi và đề xuất cập nhật (không theo cơ sở đang chọn). */
@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Của tôi")
public class SelfServiceController {

	private final StaffChangeRequestService changeRequests;

	public SelfServiceController(StaffChangeRequestService changeRequests) {
		this.changeRequests = changeRequests;
	}

	@GetMapping("/staff")
	@Operation(summary = "Hồ sơ nhân viên gắn với tài khoản (404 nếu chưa gắn)")
	public StaffDetail myProfile() {
		return changeRequests.myProfile();
	}

	@GetMapping("/change-requests")
	@Operation(summary = "Đề xuất cập nhật hồ sơ của tôi (mới nhất trước)")
	public List<ChangeRequestDto> myRequests() {
		return changeRequests.mine();
	}

	@PostMapping("/change-requests")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Gửi đề xuất cập nhật SĐT/địa chỉ hoặc tài khoản ngân hàng (chờ duyệt)")
	public ChangeRequestDto submit(@Valid @RequestBody SubmitChangeRequest request) {
		return changeRequests.submit(request.changes());
	}

}
