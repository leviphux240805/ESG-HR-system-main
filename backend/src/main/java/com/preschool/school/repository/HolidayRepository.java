package com.preschool.school.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.school.entity.Holiday;

import org.springframework.data.jpa.repository.JpaRepository;

/** Truy vấn tự lọc theo cơ sở đang chọn (Hibernate filter), không cần thêm điều kiện school_id. */
public interface HolidayRepository extends JpaRepository<Holiday, UUID> {

	List<Holiday> findAllByOrderByHolidayDate();

	/** Ngày lễ trong khoảng (đã lọc theo cơ sở: cả tổ chức + cơ sở trong phạm vi). */
	List<Holiday> findByHolidayDateBetweenOrderByHolidayDate(java.time.LocalDate from, java.time.LocalDate to);

}
