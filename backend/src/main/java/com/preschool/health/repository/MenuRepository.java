package com.preschool.health.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.health.entity.Menu;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MenuRepository extends JpaRepository<Menu, UUID> {

	/** Thực đơn tuần của cơ sở cho khối {@code ageGroupId} (rỗng = thực đơn chung mọi khối). */
	@Query("""
			select m from Menu m
			where m.schoolId = :schoolId and m.weekStart = :weekStart
			  and ((:ageGroupId is null and m.ageGroupId is null) or m.ageGroupId = :ageGroupId)""")
	Optional<Menu> findWeek(@Param("schoolId") UUID schoolId, @Param("ageGroupId") UUID ageGroupId,
			@Param("weekStart") LocalDate weekStart);

	List<Menu> findBySchoolIdAndWeekStart(UUID schoolId, LocalDate weekStart);

}
