package com.preschool.common.web;

import java.util.List;
import java.util.function.Function;

import io.swagger.v3.oas.annotations.media.Schema;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * Response chuẩn của API danh sách. Tham số vào: {@code page} (bắt đầu từ 0), {@code size} (mặc định 20, tối đa
 * 100), {@code sort=field,asc|desc} — nhận bằng {@code @ParameterObject Pageable}.
 *
 * @param items các dòng của trang hiện tại
 * @param page số trang (bắt đầu từ 0)
 * @param size số dòng mỗi trang
 * @param totalElements tổng số dòng
 * @param totalPages tổng số trang
 */
public record PageResponse<T>(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<T> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int size,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long totalElements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int totalPages) {

	public static <T> PageResponse<T> of(Page<T> page) {
		return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
				page.getTotalPages());
	}

	/** Chuyển entity sang DTO khi đóng gói trang. */
	public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
		return of(page.map(mapper));
	}

	/** Phân trang một danh sách đã lọc, xếp trong bộ nhớ (size tối đa 100; không phân trang = trả hết). */
	public static <T> PageResponse<T> slice(List<T> rows, Pageable pageable) {
		int size = pageable.isPaged() ? Math.min(pageable.getPageSize(), 100) : Math.max(rows.size(), 1);
		int page = pageable.isPaged() ? pageable.getPageNumber() : 0;
		int from = Math.min(page * size, rows.size());
		return of(new PageImpl<>(rows.subList(from, Math.min(from + size, rows.size())), PageRequest.of(page, size),
				rows.size()));
	}

}
