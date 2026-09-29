package com.preschool.school.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.school.entity.Holiday;

import org.springframework.data.jpa.repository.JpaRepository;

/** Truy vấn tự lọc theo cơ sở đang chọn (Hibernate filter), không cần thêm điều kiện school_id. */
public interface HolidayRepository extends JpaRepository<Holiday, UUID> {

	List<Holiday> findAllByOrderByHolidayDate();

}
