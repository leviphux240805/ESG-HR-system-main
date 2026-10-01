package com.preschool.health.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.health.entity.MenuItem;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {

	List<MenuItem> findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(UUID menuId);

	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from MenuItem i where i.menuId = :menuId")
	void deleteByMenuId(@Param("menuId") UUID menuId);

	boolean existsByDishId(UUID dishId);

}
