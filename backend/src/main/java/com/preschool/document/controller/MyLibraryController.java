package com.preschool.document.controller;

import java.util.List;

import com.preschool.document.dto.LibraryDtos.DocumentItem;
import com.preschool.document.service.LibraryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Văn bản cần đọc của người đang đăng nhập (không theo cơ sở đang chọn). */
@RestController
@RequestMapping("/api/v1/me/library")
@Tag(name = "Của tôi")
public class MyLibraryController {

	private final LibraryService library;

	public MyLibraryController(LibraryService library) {
		this.library = library;
	}

	@GetMapping("/documents")
	@Operation(summary = "Văn bản yêu cầu tôi xác nhận đã đọc (chưa đọc trước, tối đa 200)")
	public List<DocumentItem> documents() {
		return library.mine();
	}

}
