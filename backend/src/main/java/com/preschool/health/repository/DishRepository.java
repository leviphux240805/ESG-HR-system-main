package com.preschool.health.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.health.entity.Dish;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DishRepository extends JpaRepository<Dish, UUID> {

	List<Dish> findAllByOrderByName();

	List<Dish> findByIdIn(Collection<UUID> ids);

}
