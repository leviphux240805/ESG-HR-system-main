package com.preschool.health.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.preschool.common.web.PageResponse;
import com.preschool.health.dto.MenuDtos.AllergyWarning;
import com.preschool.health.dto.MenuDtos.CopyMenuRequest;
import com.preschool.health.dto.MenuDtos.DishDto;
import com.preschool.health.dto.MenuDtos.DishRequest;
import com.preschool.health.dto.MenuDtos.MenuWeekDto;
import com.preschool.health.dto.MenuDtos.SaveMenuRequest;
import com.preschool.health.service.MenuService;
import com.preschool.health.service.MenuService.DishFilter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
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

/** Món ăn và thực đơn tuần. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Thực đơn")
public class MenuController {

	private final MenuService menus;

	public MenuController(MenuService menus) {
		this.menus = menus;
	}

	@GetMapping("/dishes")
	@Operation(summary = "Danh mục món ăn (chung chuỗi + cơ sở đang chọn)")
	public PageResponse<DishDto> dishes(@RequestParam(required = false) String q,
			@RequestParam(required = false) Boolean shared, @RequestParam(required = false) Boolean active,
			@ParameterObject Pageable pageable) {
		return menus.dishes(new DishFilter(q, shared, active), pageable);
	}

	@PostMapping("/dishes")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm món ăn")
	public DishDto createDish(@Valid @RequestBody DishRequest request) {
		return menus.createDish(request);
	}

	@PutMapping("/dishes/{id}")
	@Operation(summary = "Sửa món ăn")
	public DishDto updateDish(@PathVariable UUID id, @Valid @RequestBody DishRequest request) {
		return menus.updateDish(id, request);
	}

	@DeleteMapping("/dishes/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa món ăn chưa dùng trong thực đơn")
	public void deleteDish(@PathVariable UUID id) {
		menus.deleteDish(id);
	}

	@GetMapping("/menus/week")
	@Operation(summary = "Thực đơn một tuần của cơ sở đang chọn (khối rỗng = chung mọi khối)")
	public MenuWeekDto week(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
			@RequestParam(required = false) UUID ageGroupId) {
		return menus.week(weekStart, ageGroupId);
	}

	@PutMapping("/menus/week")
	@Operation(summary = "Lưu cả lưới thực đơn tuần (thay toàn bộ món)")
	public MenuWeekDto save(@Valid @RequestBody SaveMenuRequest request) {
		return menus.save(request);
	}

	@PostMapping("/menus/copy")
	@Operation(summary = "Sao chép thực đơn từ tuần khác")
	public MenuWeekDto copy(@Valid @RequestBody CopyMenuRequest request) {
		return menus.copy(request);
	}

	@PostMapping("/menus/{id}/publish")
	@Operation(summary = "Công bố thực đơn")
	public MenuWeekDto publish(@PathVariable UUID id) {
		return menus.publish(id, true);
	}

	@PostMapping("/menus/{id}/unpublish")
	@Operation(summary = "Chuyển thực đơn về nháp")
	public MenuWeekDto unpublish(@PathVariable UUID id) {
		return menus.publish(id, false);
	}

	@GetMapping("/menus/allergy-warnings")
	@Operation(summary = "Trẻ có ghi chú dị ứng và các món trong tuần trùng nguyên liệu")
	public List<AllergyWarning> allergyWarnings(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
			@RequestParam(required = false) UUID ageGroupId) {
		return menus.allergyWarnings(weekStart, ageGroupId);
	}

}
