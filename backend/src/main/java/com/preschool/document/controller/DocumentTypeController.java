package com.preschool.document.controller;

import java.util.List;

import com.preschool.document.entity.DocumentType;
import com.preschool.staff.dto.StaffRecordDtos.DocumentTypeDto;
import com.preschool.staff.service.StaffRecordsService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/document-types")
@Tag(name = "Tài liệu")
public class DocumentTypeController {

	private final StaffRecordsService records;

	public DocumentTypeController(StaffRecordsService records) {
		this.records = records;
	}

	@GetMapping
	@Operation(summary = "Danh mục loại giấy tờ (dùng chung trong tổ chức)")
	public List<DocumentTypeDto> list(@RequestParam(defaultValue = "STAFF") DocumentType.Scope scope) {
		return records.documentTypes(scope);
	}

}
