package com.preschool.health.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.classroom.repository.SchoolClassRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.text.Texts;
import com.preschool.common.web.PageResponse;
import com.preschool.health.dto.MenuDtos.AllergyMatch;
import com.preschool.health.dto.MenuDtos.AllergyWarning;
import com.preschool.health.dto.MenuDtos.CopyMenuRequest;
import com.preschool.health.dto.MenuDtos.DayNutrition;
import com.preschool.health.dto.MenuDtos.DishDto;
import com.preschool.health.dto.MenuDtos.DishRequest;
import com.preschool.health.dto.MenuDtos.Ingredient;
import com.preschool.health.dto.MenuDtos.MenuItemDto;
import com.preschool.health.dto.MenuDtos.MenuItemRequest;
import com.preschool.health.dto.MenuDtos.MenuWeekDto;
import com.preschool.health.dto.MenuDtos.SaveMenuRequest;
import com.preschool.health.engine.AllergyMatcher;
import com.preschool.health.entity.Dish;
import com.preschool.health.entity.HealthEnums.MenuStatus;
import com.preschool.health.entity.Menu;
import com.preschool.health.entity.MenuItem;
import com.preschool.health.repository.DishRepository;
import com.preschool.health.repository.MenuItemRepository;
import com.preschool.health.repository.MenuRepository;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Danh mục món ăn (chung chuỗi hoặc riêng cơ sở) và thực đơn tuần theo cơ sở + khối. Cảnh báo dị ứng: mọi trẻ đang
 * học có ghi chú dị ứng đều được liệt kê, kèm các món trong tuần có nguyên liệu trùng ghi chú.
 */
@Service
@Transactional
public class MenuService {

	private static final TypeReference<List<Ingredient>> INGREDIENTS = new TypeReference<>() {
	};

	private final HealthAccess access;

	private final DishRepository dishes;

	private final MenuRepository menus;

	private final MenuItemRepository items;

	private final AgeGroupRepository ageGroups;

	private final ChildRepository children;

	private final ClassEnrollmentRepository enrollments;

	private final SchoolClassRepository classes;

	private final AuditService audit;

	private final JsonMapper json;

	private final Clock clock;

	public MenuService(HealthAccess access, DishRepository dishes, MenuRepository menus, MenuItemRepository items,
			AgeGroupRepository ageGroups, ChildRepository children, ClassEnrollmentRepository enrollments,
			SchoolClassRepository classes, AuditService audit, JsonMapper json, Clock clock) {
		this.access = access;
		this.dishes = dishes;
		this.menus = menus;
		this.items = items;
		this.ageGroups = ageGroups;
		this.children = children;
		this.enrollments = enrollments;
		this.classes = classes;
		this.audit = audit;
		this.json = json;
		this.clock = clock;
	}

	// ------------------------------------------------------------ món ăn

	public record DishFilter(String q, Boolean shared, Boolean active) {
	}

	@Transactional(readOnly = true)
	public PageResponse<DishDto> dishes(DishFilter filter, Pageable pageable) {
		access.requireViewMenuAny();
		String q = filter.q() == null ? "" : Texts.fold(filter.q().trim());
		List<DishDto> rows = dishes.findAllByOrderByName()
			.stream()
			.filter(d -> filter.active() == null || d.isActive() == filter.active())
			.filter(d -> filter.shared() == null || (d.getSchoolId() == null) == filter.shared())
			.filter(d -> q.isEmpty() || Texts.fold(d.getName()).contains(q)
					|| ingredients(d).stream().anyMatch(i -> Texts.fold(i.name()).contains(q)))
			.map(this::toDto)
			.toList();
		return PageResponse.slice(rows, pageable);
	}

	public DishDto createDish(DishRequest r) {
		UUID schoolId = null;
		if (Boolean.TRUE.equals(r.shared())) {
			access.requireManageSharedDishes();
		}
		else {
			schoolId = access.requireSelectedSchool();
			access.requireEditMenu(schoolId);
		}
		requireUniqueName(schoolId, r.name().trim(), null);
		Dish dish = new Dish(schoolId);
		apply(dish, r);
		dishes.save(dish);
		audit.record("dishes", dish.getId(), Action.CREATE, null, Map.of("name", dish.getName()));
		return toDto(dish);
	}

	public DishDto updateDish(UUID id, DishRequest r) {
		Dish dish = editableDish(id);
		requireUniqueName(dish.getSchoolId(), r.name().trim(), id);
		Map<String, Object> before = Map.of("name", dish.getName(), "ingredients", dish.getIngredients());
		apply(dish, r);
		audit.record("dishes", id, Action.UPDATE, before,
				Map.of("name", dish.getName(), "ingredients", dish.getIngredients()));
		return toDto(dish);
	}

	public void deleteDish(UUID id) {
		Dish dish = editableDish(id);
		if (items.existsByDishId(id)) {
			throw ApiException.conflict("DISH_IN_USE", "Món đã có trong thực đơn, hãy chuyển sang ngừng dùng thay vì xóa.");
		}
		audit.record("dishes", id, Action.DELETE, Map.of("name", dish.getName()), null);
		dishes.delete(dish);
	}

	private Dish editableDish(UUID id) {
		Dish dish = dishes.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy món ăn."));
		if (dish.getSchoolId() == null) {
			access.requireManageSharedDishes();
		}
		else {
			access.requireEditMenu(dish.getSchoolId());
		}
		return dish;
	}

	private void apply(Dish dish, DishRequest r) {
		List<Ingredient> list = r.ingredients()
			.stream()
			.map(i -> new Ingredient(i.name().trim(), i.grams()))
			.toList();
		dish.update(r.name().trim(), json.writeValueAsString(list), r.kcal(), r.proteinG(), r.fatG(), r.carbG(),
				r.active() == null || r.active());
	}

	private void requireUniqueName(UUID schoolId, String name, UUID exceptId) {
		String folded = Texts.fold(name);
		boolean taken = dishes.findAllByOrderByName()
			.stream()
			.anyMatch(d -> Objects.equals(d.getSchoolId(), schoolId) && !d.getId().equals(exceptId)
					&& Texts.fold(d.getName()).equals(folded));
		if (taken) {
			throw ApiException.conflict("DISH_EXISTS", "Đã có món cùng tên.")
				.withFieldErrors(List.of(Map.of("field", "name", "message", "Đã có món cùng tên.")));
		}
	}

	private List<Ingredient> ingredients(Dish d) {
		return json.readValue(d.getIngredients(), INGREDIENTS);
	}

	private DishDto toDto(Dish d) {
		boolean canEdit = d.getSchoolId() == null ? access.canManageSharedDishes()
				: access.canEditMenu(d.getSchoolId());
		return new DishDto(d.getId(), d.getSchoolId(), d.getSchoolId() == null, d.getName(), ingredients(d), d.getKcal(),
				d.getProteinG(), d.getFatG(), d.getCarbG(), d.isActive(), canEdit);
	}

	// ------------------------------------------------------------ thực đơn tuần

	@Transactional(readOnly = true)
	public MenuWeekDto week(LocalDate weekStart, UUID ageGroupId) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireViewMenu(schoolId);
		requireMonday(weekStart);
		requireAgeGroup(ageGroupId);
		return build(schoolId, ageGroupId, weekStart, menus.findWeek(schoolId, ageGroupId, weekStart).orElse(null));
	}

	public MenuWeekDto save(SaveMenuRequest r) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireEditMenu(schoolId);
		requireMonday(r.weekStart());
		requireAgeGroup(r.ageGroupId());
		Menu menu = menus.findWeek(schoolId, r.ageGroupId(), r.weekStart())
			.orElseGet(() -> menus.save(new Menu(schoolId, r.ageGroupId(), r.weekStart())));
		Set<UUID> existing = items.findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(menu.getId())
			.stream()
			.map(MenuItem::getDishId)
			.collect(Collectors.toSet());
		Map<UUID, Dish> dishById = visibleDishes(r.items().stream().map(MenuItemRequest::dishId).toList());
		LocalDate weekEnd = r.weekStart().plusDays(6);
		for (MenuItemRequest i : r.items()) {
			if (i.date().isBefore(r.weekStart()) || i.date().isAfter(weekEnd)) {
				throw ApiException.badRequest("MENU_DATE_OUT_OF_WEEK", "Ngày của món nằm ngoài tuần đang sửa.");
			}
			Dish dish = dishById.get(i.dishId());
			if (dish == null || (!dish.isActive() && !existing.contains(dish.getId()))) {
				throw ApiException.badRequest("INVALID_DISH", "Món ăn không hợp lệ hoặc đã ngừng dùng.");
			}
		}
		menu.setNote(blankToNull(r.note()));
		UUID menuId = menu.getId();
		items.deleteByMenuId(menuId);
		Map<String, Integer> order = new LinkedHashMap<>();
		Set<String> seen = new HashSet<>();
		for (MenuItemRequest i : r.items()) {
			if (!seen.add(i.date() + "|" + i.meal() + "|" + i.dishId())) {
				continue;
			}
			int no = order.merge(i.date() + "|" + i.meal(), 1, Integer::sum);
			items.save(new MenuItem(schoolId, menuId, i.date(), i.meal(), i.dishId(), no, blankToNull(i.note())));
		}
		audit.record("menus", menuId, Action.UPDATE, null,
				Map.of("weekStart", r.weekStart().toString(), "items", seen.size()));
		return build(schoolId, r.ageGroupId(), r.weekStart(), menus.findById(menuId).orElseThrow());
	}

	public MenuWeekDto copy(CopyMenuRequest r) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireEditMenu(schoolId);
		requireMonday(r.fromWeekStart());
		requireMonday(r.toWeekStart());
		requireAgeGroup(r.ageGroupId());
		if (r.fromWeekStart().equals(r.toWeekStart())) {
			throw ApiException.badRequest("MENU_SAME_WEEK", "Tuần nguồn và tuần đích phải khác nhau.");
		}
		Menu source = menus.findWeek(schoolId, r.ageGroupId(), r.fromWeekStart()).orElse(null);
		List<MenuItem> sourceItems = source == null ? List.of()
				: items.findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(source.getId());
		if (sourceItems.isEmpty()) {
			throw ApiException.badRequest("MENU_SOURCE_EMPTY", "Tuần nguồn chưa có thực đơn để sao chép.");
		}
		Menu target = menus.findWeek(schoolId, r.ageGroupId(), r.toWeekStart())
			.orElseGet(() -> menus.save(new Menu(schoolId, r.ageGroupId(), r.toWeekStart())));
		UUID targetId = target.getId();
		if (!items.findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(targetId).isEmpty() && !Boolean.TRUE.equals(r.overwrite())) {
			throw ApiException.conflict("MENU_NOT_EMPTY", "Tuần đích đã có thực đơn. Chọn ghi đè nếu muốn thay thế.");
		}
		target.setNote(source.getNote());
		target.unpublish();
		long shift = ChronoUnit.DAYS.between(r.fromWeekStart(), r.toWeekStart());
		items.deleteByMenuId(targetId);
		for (MenuItem i : sourceItems) {
			items.save(new MenuItem(schoolId, targetId, i.getMenuDate().plusDays(shift), i.getMeal(), i.getDishId(),
					i.getOrderNo(), i.getNote()));
		}
		audit.record("menus", targetId, Action.UPDATE, null,
				Map.of("copiedFrom", r.fromWeekStart().toString(), "items", sourceItems.size()));
		return build(schoolId, r.ageGroupId(), r.toWeekStart(), menus.findById(targetId).orElseThrow());
	}

	public MenuWeekDto publish(UUID id, boolean publish) {
		Menu menu = menus.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy thực đơn."));
		access.requireEditMenu(menu.getSchoolId());
		if (publish) {
			if (items.findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(id).isEmpty()) {
				throw ApiException.badRequest("MENU_EMPTY", "Thực đơn chưa có món nào.");
			}
			menu.publish(clock.instant());
		}
		else {
			menu.unpublish();
		}
		audit.record("menus", id, Action.UPDATE, null, Map.of("status", menu.getStatus().name()));
		return build(menu.getSchoolId(), menu.getAgeGroupId(), menu.getWeekStart(), menu);
	}

	@Transactional(readOnly = true)
	public List<AllergyWarning> allergyWarnings(LocalDate weekStart, UUID ageGroupId) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireViewMenu(schoolId);
		requireMonday(weekStart);
		requireAgeGroup(ageGroupId);
		Menu menu = menus.findWeek(schoolId, ageGroupId, weekStart).orElse(null);
		List<MenuItem> list = menu == null ? List.of() : items.findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(menu.getId());
		return warnings(schoolId, ageGroupId, list, visibleDishes(list.stream().map(MenuItem::getDishId).toList()));
	}

	// ------------------------------------------------------------ hỗ trợ

	private MenuWeekDto build(UUID schoolId, UUID ageGroupId, LocalDate weekStart, Menu menu) {
		List<MenuItem> list = menu == null ? List.of()
				: items.findByMenuIdOrderByMenuDateAscMealAscOrderNoAsc(menu.getId())
					.stream()
					.sorted(Comparator.comparing(MenuItem::getMenuDate)
						.thenComparing(MenuItem::getMeal)
						.thenComparing(MenuItem::getOrderNo))
					.toList();
		Map<UUID, Dish> dishById = visibleDishes(list.stream().map(MenuItem::getDishId).toList());
		List<MenuItemDto> rows = list.stream().map(i -> {
			Dish d = dishById.get(i.getDishId());
			return new MenuItemDto(i.getId(), i.getMenuDate(), i.getMeal(), i.getDishId(), d == null ? "" : d.getName(),
					i.getOrderNo(), i.getNote(), d == null ? null : d.getKcal());
		}).toList();
		Map<LocalDate, BigDecimal[]> totals = new TreeMap<>();
		for (MenuItem i : list) {
			Dish d = dishById.get(i.getDishId());
			BigDecimal[] t = totals.computeIfAbsent(i.getMenuDate(),
					k -> new BigDecimal[] { BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO });
			if (d != null) {
				t[0] = t[0].add(nz(d.getKcal()));
				t[1] = t[1].add(nz(d.getProteinG()));
				t[2] = t[2].add(nz(d.getFatG()));
				t[3] = t[3].add(nz(d.getCarbG()));
			}
		}
		List<DayNutrition> days = totals.entrySet()
			.stream()
			.map(e -> new DayNutrition(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2], e.getValue()[3]))
			.toList();
		int alerts = (int) warnings(schoolId, ageGroupId, list, dishById).stream()
			.filter(w -> !w.matches().isEmpty())
			.count();
		return new MenuWeekDto(menu == null ? null : menu.getId(), schoolId, ageGroupId, weekStart,
				menu == null ? MenuStatus.DRAFT : menu.getStatus(), menu == null ? null : menu.getNote(),
				menu == null ? null : menu.getPublishedAt(), rows, days, alerts, access.canEditMenu(schoolId));
	}

	private List<AllergyWarning> warnings(UUID schoolId, UUID ageGroupId, List<MenuItem> list,
			Map<UUID, Dish> dishById) {
		List<Child> allergic = children.findAll((root, q, cb) -> cb.and(cb.equal(root.get("schoolId"), schoolId),
				cb.equal(root.get("status"), ChildStatus.STUDYING), cb.isNotNull(root.get("allergyNote")),
				cb.notEqual(cb.trim(root.<String>get("allergyNote")), "")));
		if (allergic.isEmpty()) {
			return List.of();
		}
		Map<UUID, UUID> classByChild = enrollments
			.findByChildIdInAndToDateIsNull(allergic.stream().map(Child::getId).toList())
			.stream()
			.collect(Collectors.toMap(ClassEnrollment::getChildId, ClassEnrollment::getClassId, (a, b) -> a));
		Map<UUID, SchoolClass> classById = classes.findByIdIn(new HashSet<>(classByChild.values()))
			.stream()
			.collect(Collectors.toMap(SchoolClass::getId, Function.identity()));
		Map<UUID, List<Ingredient>> ingredientsByDish = new LinkedHashMap<>();
		dishById.values().forEach(d -> ingredientsByDish.put(d.getId(), ingredients(d)));
		List<AllergyWarning> out = new ArrayList<>();
		for (Child child : allergic.stream().sorted(Comparator.comparing(Child::getFullName)).toList()) {
			SchoolClass c = classById.get(classByChild.get(child.getId()));
			if (ageGroupId != null && (c == null || !ageGroupId.equals(c.getAgeGroupId()))) {
				continue;
			}
			List<String> keywords = AllergyMatcher.keywords(child.getAllergyNote());
			List<AllergyMatch> matches = new ArrayList<>();
			for (MenuItem i : list) {
				Dish d = dishById.get(i.getDishId());
				if (d == null) {
					continue;
				}
				String hit = ingredientsByDish.get(d.getId())
					.stream()
					.map(Ingredient::name)
					.filter(n -> AllergyMatcher.match(keywords, n) != null)
					.findFirst()
					.orElse(AllergyMatcher.match(keywords, d.getName()) != null ? d.getName() : null);
				if (hit != null) {
					matches.add(new AllergyMatch(i.getMenuDate(), i.getMeal(), d.getName(), hit));
				}
			}
			out.add(new AllergyWarning(child.getId(), child.getFullName(), c == null ? null : c.getName(),
					child.getAllergyNote(), matches));
		}
		return out;
	}

	private Map<UUID, Dish> visibleDishes(List<UUID> ids) {
		return dishes.findByIdIn(new HashSet<>(ids)).stream().collect(Collectors.toMap(Dish::getId, Function.identity()));
	}

	private static void requireMonday(LocalDate weekStart) {
		if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
			throw ApiException.badRequest("MENU_WEEK_START", "Tuần phải bắt đầu từ thứ Hai.");
		}
	}

	private void requireAgeGroup(UUID ageGroupId) {
		if (ageGroupId != null && !ageGroups.existsById(ageGroupId)) {
			throw ApiException.badRequest("INVALID_AGE_GROUP", "Khối không hợp lệ.");
		}
	}

	private static BigDecimal nz(BigDecimal v) {
		return v == null ? BigDecimal.ZERO : v;
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

}
