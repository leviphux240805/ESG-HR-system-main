package com.preschool.finance.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.classroom.entity.AgeGroup;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.finance.dto.FeeCatalogDtos.ChildDiscountDto;
import com.preschool.finance.dto.FeeCatalogDtos.ChildDiscountRequest;
import com.preschool.finance.dto.FeeCatalogDtos.ChildFeeItemDto;
import com.preschool.finance.dto.FeeCatalogDtos.ChildFeeItemRequest;
import com.preschool.finance.dto.FeeCatalogDtos.CreateFeeTypeRequest;
import com.preschool.finance.dto.FeeCatalogDtos.FeeScheduleDto;
import com.preschool.finance.dto.FeeCatalogDtos.FeeScheduleRequest;
import com.preschool.finance.dto.FeeCatalogDtos.FeeTypeDto;
import com.preschool.finance.dto.FeeCatalogDtos.FinanceConfigDto;
import com.preschool.finance.dto.FeeCatalogDtos.FinanceConfigRequest;
import com.preschool.finance.dto.FeeCatalogDtos.UpdateFeeTypeRequest;
import com.preschool.finance.entity.ChildDiscount;
import com.preschool.finance.entity.ChildFeeItem;
import com.preschool.finance.entity.FeeSchedule;
import com.preschool.finance.entity.FeeType;
import com.preschool.finance.entity.FinanceConfig;
import com.preschool.finance.entity.FinanceEnums.CalcMethod;
import com.preschool.finance.repository.ChildDiscountRepository;
import com.preschool.finance.repository.ChildFeeItemRepository;
import com.preschool.finance.repository.FeeScheduleRepository;
import com.preschool.finance.repository.FeeTypeRepository;
import com.preschool.finance.repository.FinanceConfigRepository;
import com.preschool.school.repository.SchoolYearRepository;
import com.preschool.security.SchoolScope;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Danh mục khoản thu, biểu phí theo cơ sở, khoản tự chọn và miễn giảm của trẻ, cấu hình học phí theo ngày hiệu lực. */
@Service
@Transactional
public class FeeCatalogService {

	private final FinanceAccess access;

	private final FeeTypeRepository feeTypes;

	private final FeeScheduleRepository schedules;

	private final ChildFeeItemRepository feeItems;

	private final ChildDiscountRepository discounts;

	private final FinanceConfigRepository configs;

	private final ChildRepository children;

	private final AgeGroupRepository ageGroups;

	private final SchoolYearRepository schoolYears;

	private final AuditService audit;

	public FeeCatalogService(FinanceAccess access, FeeTypeRepository feeTypes, FeeScheduleRepository schedules,
			ChildFeeItemRepository feeItems, ChildDiscountRepository discounts, FinanceConfigRepository configs,
			ChildRepository children, AgeGroupRepository ageGroups, SchoolYearRepository schoolYears,
			AuditService audit) {
		this.access = access;
		this.feeTypes = feeTypes;
		this.schedules = schedules;
		this.feeItems = feeItems;
		this.discounts = discounts;
		this.configs = configs;
		this.children = children;
		this.ageGroups = ageGroups;
		this.schoolYears = schoolYears;
		this.audit = audit;
	}

	// ------------------------------------------------------------ khoản thu

	@Transactional(readOnly = true)
	public List<FeeTypeDto> feeTypes() {
		access.requireViewAny();
		return feeTypes.findAllByOrderByOrderNoAscNameAsc().stream().map(FeeCatalogService::toDto).toList();
	}

	public FeeTypeDto createFeeType(CreateFeeTypeRequest r) {
		access.requireManageCatalog();
		if (feeTypes.existsByCode(r.code())) {
			throw ApiException.conflict("FEE_TYPE_CODE_TAKEN", "Mã khoản thu đã tồn tại.")
				.withFieldErrors(List.of(Map.of("field", "code", "message", "Mã khoản thu đã tồn tại.")));
		}
		FeeType t = feeTypes.save(new FeeType(r.code(), r.name().trim(), r.calcMethod(),
				Boolean.TRUE.equals(r.refundableOnAbsence()), r.orderNo()));
		audit.record("fee_types", t.getId(), Action.CREATE, null, toDto(t));
		return toDto(t);
	}

	public FeeTypeDto updateFeeType(UUID id, UpdateFeeTypeRequest r) {
		access.requireManageCatalog();
		FeeType t = feeTypes.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy khoản thu."));
		FeeTypeDto before = toDto(t);
		t.update(r.name().trim(), Boolean.TRUE.equals(r.refundableOnAbsence()), r.active(), r.orderNo());
		audit.record("fee_types", id, Action.UPDATE, before, toDto(t));
		return toDto(t);
	}

	// ------------------------------------------------------------ biểu phí

	/** Biểu phí của cơ sở đang chọn (hoặc mọi cơ sở được xem nếu chọn "tất cả"). */
	@Transactional(readOnly = true)
	public List<FeeScheduleDto> schedules(UUID schoolYearId) {
		access.requireViewAny();
		UUID selected = SchoolScope.require().selectedSchoolId();
		if (selected != null) {
			access.requireView(selected);
		}
		Map<UUID, FeeType> types = feeTypeMap();
		Map<UUID, AgeGroup> groups = ageGroups.findAll().stream().collect(Collectors.toMap(AgeGroup::getId, g -> g));
		return schedules.findAll()
			.stream()
			.filter(s -> selected == null ? access.canView(s.getSchoolId()) : s.getSchoolId().equals(selected))
			.filter(s -> schoolYearId == null || s.getSchoolYearId().equals(schoolYearId))
			.sorted(Comparator.comparing((FeeSchedule s) -> types.get(s.getFeeTypeId()).getOrderNo())
				.thenComparing(s -> s.getAgeGroupId() == null ? -1 : groups.get(s.getAgeGroupId()).getOrderNo())
				.thenComparing(FeeSchedule::getEffectiveFrom, Comparator.reverseOrder()))
			.map(s -> toDto(s, types, groups))
			.toList();
	}

	public FeeScheduleDto createSchedule(FeeScheduleRequest r) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		if (!schoolYears.existsById(r.schoolYearId())) {
			throw fieldError("schoolYearId", "Năm học không tồn tại.");
		}
		FeeType type = feeTypes.findById(r.feeTypeId())
			.filter(FeeType::isActive)
			.orElseThrow(() -> fieldError("feeTypeId", "Khoản thu không tồn tại hoặc đã ngừng."));
		if (r.ageGroupId() != null && !ageGroups.existsById(r.ageGroupId())) {
			throw fieldError("ageGroupId", "Khối không tồn tại.");
		}
		FeeSchedule s;
		try {
			s = schedules.saveAndFlush(new FeeSchedule(schoolId, r.schoolYearId(), r.ageGroupId(), type.getId(),
					r.amount(), r.effectiveFrom(), blankToNull(r.note())));
		}
		catch (DataIntegrityViolationException e) {
			throw ApiException.conflict("FEE_SCHEDULE_EXISTS", "Đã có mức phí này với cùng ngày hiệu lực.");
		}
		FeeScheduleDto dto = toDto(s, feeTypeMap(), ageGroupMap());
		audit.record("fee_schedules", s.getId(), Action.CREATE, null, dto);
		return dto;
	}

	/** Xóa mức phí nhập nhầm; phiếu đã sinh giữ nguyên số tiền đã chốt. */
	public void deleteSchedule(UUID id) {
		FeeSchedule s = schedules.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy mức phí."));
		access.requireManage(s.getSchoolId());
		audit.record("fee_schedules", id, Action.DELETE, toDto(s, feeTypeMap(), ageGroupMap()), null);
		schedules.delete(s);
	}

	// ------------------------------------------------------------ khoản tự chọn của trẻ

	@Transactional(readOnly = true)
	public List<ChildFeeItemDto> feeItems(UUID childId) {
		Child child = visibleChild(childId);
		Map<UUID, FeeType> types = feeTypeMap();
		return feeItems.findByChildIdOrderByFromMonthDesc(child.getId()).stream().map(i -> toDto(i, types)).toList();
	}

	public ChildFeeItemDto addFeeItem(UUID childId, ChildFeeItemRequest r) {
		Child child = managedChild(childId);
		ChildFeeItem item = new ChildFeeItem(child.getSchoolId(), child.getId(), optionalFeeType(r.feeTypeId()).getId());
		applyFeeItem(item, r);
		feeItems.save(item);
		ChildFeeItemDto dto = toDto(item, feeTypeMap());
		audit.record("child_fee_items", item.getId(), Action.CREATE, null, dto);
		return dto;
	}

	public ChildFeeItemDto updateFeeItem(UUID childId, UUID itemId, ChildFeeItemRequest r) {
		Child child = managedChild(childId);
		ChildFeeItem item = feeItems.findById(itemId)
			.filter(i -> i.getChildId().equals(child.getId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy khoản đăng ký."));
		if (!item.getFeeTypeId().equals(r.feeTypeId())) {
			throw fieldError("feeTypeId", "Không đổi được khoản thu; hãy kết thúc và thêm khoản mới.");
		}
		ChildFeeItemDto before = toDto(item, feeTypeMap());
		applyFeeItem(item, r);
		ChildFeeItemDto after = toDto(item, feeTypeMap());
		audit.record("child_fee_items", itemId, Action.UPDATE, before, after);
		return after;
	}

	public void deleteFeeItem(UUID childId, UUID itemId) {
		Child child = managedChild(childId);
		ChildFeeItem item = feeItems.findById(itemId)
			.filter(i -> i.getChildId().equals(child.getId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy khoản đăng ký."));
		audit.record("child_fee_items", itemId, Action.DELETE, toDto(item, feeTypeMap()), null);
		feeItems.delete(item);
	}

	private void applyFeeItem(ChildFeeItem item, ChildFeeItemRequest r) {
		LocalDate from = firstOfMonth(r.fromMonth());
		LocalDate to = firstOfMonth(r.toMonth());
		requireRange(from, to);
		item.update(from, to, blankToNull(r.note()));
	}

	private FeeType optionalFeeType(UUID id) {
		return feeTypes.findById(id)
			.filter(t -> t.isActive() && t.getCalcMethod() == CalcMethod.OPTIONAL)
			.orElseThrow(() -> fieldError("feeTypeId", "Chỉ đăng ký được khoản thu tự chọn đang dùng."));
	}

	// ------------------------------------------------------------ miễn giảm

	@Transactional(readOnly = true)
	public List<ChildDiscountDto> discounts(UUID childId) {
		Child child = visibleChild(childId);
		Map<UUID, FeeType> types = feeTypeMap();
		return discounts.findByChildIdOrderByFromMonthDesc(child.getId()).stream().map(d -> toDto(d, types)).toList();
	}

	public ChildDiscountDto addDiscount(UUID childId, ChildDiscountRequest r) {
		Child child = managedChild(childId);
		ChildDiscount d = new ChildDiscount(child.getSchoolId(), child.getId());
		applyDiscount(d, r);
		discounts.save(d);
		ChildDiscountDto dto = toDto(d, feeTypeMap());
		audit.record("child_discounts", d.getId(), Action.CREATE, null, dto);
		return dto;
	}

	public ChildDiscountDto updateDiscount(UUID childId, UUID discountId, ChildDiscountRequest r) {
		Child child = managedChild(childId);
		ChildDiscount d = discounts.findById(discountId)
			.filter(x -> x.getChildId().equals(child.getId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy miễn giảm."));
		ChildDiscountDto before = toDto(d, feeTypeMap());
		applyDiscount(d, r);
		ChildDiscountDto after = toDto(d, feeTypeMap());
		audit.record("child_discounts", discountId, Action.UPDATE, before, after);
		return after;
	}

	public void deleteDiscount(UUID childId, UUID discountId) {
		Child child = managedChild(childId);
		ChildDiscount d = discounts.findById(discountId)
			.filter(x -> x.getChildId().equals(child.getId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy miễn giảm."));
		audit.record("child_discounts", discountId, Action.DELETE, toDto(d, feeTypeMap()), null);
		discounts.delete(d);
	}

	private void applyDiscount(ChildDiscount d, ChildDiscountRequest r) {
		if ((r.percent() == null) == (r.amount() == null)) {
			throw fieldError("percent", "Nhập phần trăm hoặc số tiền (chỉ một trong hai).");
		}
		if (r.feeTypeId() != null && !feeTypes.existsById(r.feeTypeId())) {
			throw fieldError("feeTypeId", "Khoản thu không tồn tại.");
		}
		LocalDate from = firstOfMonth(r.fromMonth());
		LocalDate to = firstOfMonth(r.toMonth());
		requireRange(from, to);
		d.update(r.feeTypeId(), r.percent(), r.amount(), r.reason().trim(), from, to);
	}

	// ------------------------------------------------------------ cấu hình

	/** Lịch sử cấu hình áp dụng cho cơ sở đang chọn (cả bản chung của tổ chức). */
	@Transactional(readOnly = true)
	public List<FinanceConfigDto> configHistory() {
		UUID schoolId = access.requireSelectedSchool();
		access.requireView(schoolId);
		return configs.findHistory(schoolId).stream().map(FeeCatalogService::toDto).toList();
	}

	public FinanceConfigDto createConfig(FinanceConfigRequest r) {
		UUID schoolId = null;
		if (Boolean.TRUE.equals(r.organizationWide())) {
			access.requireManageCatalog();
		}
		else {
			schoolId = access.requireSelectedSchool();
			access.requireManage(schoolId);
		}
		FinanceConfig c;
		try {
			c = configs.saveAndFlush(
					new FinanceConfig(schoolId, r.effectiveFrom(), r.mealRefundRule(), r.proration(), r.dueDay()));
		}
		catch (DataIntegrityViolationException e) {
			throw ApiException.conflict("FINANCE_CONFIG_EXISTS", "Đã có cấu hình với ngày hiệu lực này.")
				.withFieldErrors(List.of(Map.of("field", "effectiveFrom", "message", "Chọn ngày hiệu lực khác.")));
		}
		audit.record("finance_configs", c.getId(), Action.CREATE, null, toDto(c));
		return toDto(c);
	}

	/** Cấu hình hiệu lực ngày {@code date} cho cơ sở: bản riêng cơ sở mới nhất, không có thì bản chung. */
	@Transactional(readOnly = true)
	public FinanceConfig effectiveConfig(UUID schoolId, LocalDate date) {
		return configs.findEffective(schoolId, date)
			.stream()
			.findFirst()
			.orElseThrow(() -> ApiException.conflict("FINANCE_CONFIG_MISSING", "Chưa có cấu hình học phí."));
	}

	// ------------------------------------------------------------ hỗ trợ

	/** Trẻ thuộc cơ sở người dùng được xem học phí; ngoài phạm vi trả 404. */
	public Child visibleChild(UUID id) {
		return children.findById(id)
			.filter(c -> access.canView(c.getSchoolId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy hồ sơ trẻ."));
	}

	private Child managedChild(UUID id) {
		Child child = visibleChild(id);
		access.requireManage(child.getSchoolId());
		return child;
	}

	public Map<UUID, FeeType> feeTypeMap() {
		return feeTypes.findAll().stream().collect(Collectors.toMap(FeeType::getId, Function.identity()));
	}

	private Map<UUID, AgeGroup> ageGroupMap() {
		return ageGroups.findAll().stream().collect(Collectors.toMap(AgeGroup::getId, Function.identity()));
	}

	static LocalDate firstOfMonth(LocalDate d) {
		return d == null ? null : d.withDayOfMonth(1);
	}

	private static void requireRange(LocalDate from, LocalDate to) {
		if (to != null && to.isBefore(from)) {
			throw fieldError("toMonth", "Tháng kết thúc phải sau tháng bắt đầu.");
		}
	}

	private static ApiException fieldError(String field, String message) {
		return ApiException.badRequest("VALIDATION_FAILED", message)
			.withFieldErrors(List.of(Map.of("field", field, "message", message)));
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

	static FeeTypeDto toDto(FeeType t) {
		return new FeeTypeDto(t.getId(), t.getCode(), t.getName(), t.getCalcMethod(), t.isRefundableOnAbsence(),
				t.isActive(), t.getOrderNo());
	}

	private static FeeScheduleDto toDto(FeeSchedule s, Map<UUID, FeeType> types, Map<UUID, AgeGroup> groups) {
		FeeType t = types.get(s.getFeeTypeId());
		AgeGroup g = s.getAgeGroupId() == null ? null : groups.get(s.getAgeGroupId());
		return new FeeScheduleDto(s.getId(), s.getSchoolId(), s.getSchoolYearId(), s.getAgeGroupId(),
				g == null ? null : g.getName(), t.getId(), t.getName(), t.getCalcMethod(), s.getAmount(),
				s.getEffectiveFrom(), s.getNote());
	}

	private static ChildFeeItemDto toDto(ChildFeeItem i, Map<UUID, FeeType> types) {
		return new ChildFeeItemDto(i.getId(), i.getFeeTypeId(), types.get(i.getFeeTypeId()).getName(), i.getFromMonth(),
				i.getToMonth(), i.getNote());
	}

	private static ChildDiscountDto toDto(ChildDiscount d, Map<UUID, FeeType> types) {
		FeeType t = d.getFeeTypeId() == null ? null : types.get(d.getFeeTypeId());
		BigDecimal percent = d.getPercent() == null ? null : d.getPercent().stripTrailingZeros();
		return new ChildDiscountDto(d.getId(), d.getFeeTypeId(), t == null ? null : t.getName(), percent, d.getAmount(),
				d.getReason(), d.getFromMonth(), d.getToMonth());
	}

	private static FinanceConfigDto toDto(FinanceConfig c) {
		return new FinanceConfigDto(c.getId(), c.getSchoolId(), c.getEffectiveFrom(), c.getMealRefundRule(),
				c.getProration(), c.getDueDay());
	}

}
