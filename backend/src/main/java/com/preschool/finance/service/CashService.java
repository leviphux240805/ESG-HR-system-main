package com.preschool.finance.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileDtos.DownloadUrlResponse;
import com.preschool.common.file.FileService;
import com.preschool.common.file.StoredFile;
import com.preschool.common.web.PageResponse;
import com.preschool.finance.dto.CashDtos.CashCategoryDto;
import com.preschool.finance.dto.CashDtos.CashEntryDto;
import com.preschool.finance.dto.CashDtos.CashEntryRequest;
import com.preschool.finance.dto.CashDtos.CashSummary;
import com.preschool.finance.dto.CashDtos.CategoryTotal;
import com.preschool.finance.dto.CashDtos.CreateCashCategoryRequest;
import com.preschool.finance.dto.CashDtos.UpdateCashCategoryRequest;
import com.preschool.finance.entity.CashCategory;
import com.preschool.finance.entity.CashEntry;
import com.preschool.finance.entity.FinanceEnums.CashSource;
import com.preschool.finance.entity.FinanceEnums.Direction;
import com.preschool.finance.entity.Payment;
import com.preschool.finance.repository.CashCategoryRepository;
import com.preschool.finance.repository.CashEntryRepository;
import com.preschool.finance.repository.PaymentRepository;
import com.preschool.security.SchoolScope;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

/**
 * Sổ thu chi theo cơ sở. Kế toán nhập tay các khoản thu/chi khác; dòng tự sinh (thanh toán học phí, lương) chỉ xem,
 * muốn sửa thì sửa ở nguồn. Danh mục dùng chung do hiệu trưởng quản lý.
 */
@Service
@Transactional
public class CashService {

	private final FinanceAccess access;

	private final CashEntryRepository entries;

	private final CashCategoryRepository categories;

	private final PaymentRepository payments;

	private final UserRepository users;

	private final FileService files;

	private final AuditService audit;

	public CashService(FinanceAccess access, CashEntryRepository entries, CashCategoryRepository categories,
			PaymentRepository payments, UserRepository users, FileService files, AuditService audit) {
		this.access = access;
		this.entries = entries;
		this.categories = categories;
		this.payments = payments;
		this.users = users;
		this.files = files;
		this.audit = audit;
	}

	// ------------------------------------------------------------ danh mục

	@Transactional(readOnly = true)
	public List<CashCategoryDto> categories() {
		access.requireViewAny();
		return categories.findAllByOrderByDirectionAscOrderNoAscNameAsc().stream().map(CashService::toDto).toList();
	}

	public CashCategoryDto createCategory(CreateCashCategoryRequest r) {
		access.requireManageCatalog();
		requireUniqueName(r.direction(), r.name().trim(), null);
		CashCategory category = categories.save(new CashCategory(null, r.direction(), r.name().trim(), r.orderNo()));
		audit.record("cash_categories", category.getId(), Action.CREATE, null,
				Map.of("direction", r.direction(), "name", category.getName()));
		return toDto(category);
	}

	public CashCategoryDto updateCategory(UUID id, UpdateCashCategoryRequest r) {
		access.requireManageCatalog();
		CashCategory category = categories.findById(id)
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy danh mục thu chi."));
		if (category.isSystem()) {
			throw ApiException.conflict("CASH_CATEGORY_SYSTEM",
					"Danh mục của dòng tự sinh (học phí, lương) không sửa được.");
		}
		requireUniqueName(category.getDirection(), r.name().trim(), id);
		Map<String, Object> before = Map.of("name", category.getName(), "active", category.isActive());
		category.update(r.name().trim(), r.active(), r.orderNo());
		audit.record("cash_categories", id, Action.UPDATE, before,
				Map.of("name", category.getName(), "active", category.isActive()));
		return toDto(category);
	}

	private void requireUniqueName(Direction direction, String name, UUID exceptId) {
		String folded = InvoiceService.fold(name);
		boolean taken = categories.findAll()
			.stream()
			.anyMatch(c -> c.getDirection() == direction && !c.getId().equals(exceptId)
					&& InvoiceService.fold(c.getName()).equals(folded));
		if (taken) {
			throw ApiException.conflict("CASH_CATEGORY_EXISTS", "Đã có danh mục cùng tên.")
				.withFieldErrors(List.of(Map.of("field", "name", "message", "Đã có danh mục cùng tên.")));
		}
	}

	private static CashCategoryDto toDto(CashCategory c) {
		return new CashCategoryDto(c.getId(), c.getDirection(), c.getName(), c.isSystem(), c.isActive(),
				c.getOrderNo());
	}

	// ------------------------------------------------------------ sổ thu chi

	public record EntryFilter(LocalDate from, LocalDate to, Direction direction, UUID categoryId, String q) {
	}

	@Transactional(readOnly = true)
	public PageResponse<CashEntryDto> list(EntryFilter filter, Pageable pageable) {
		Collection<UUID> schoolIds = viewableSchools();
		String q = filter.q() == null ? "" : InvoiceService.fold(filter.q().trim());
		List<CashEntry> found = entries.findAll(spec(schoolIds, filter),
				Sort.by(Sort.Order.desc("entryDate"), Sort.Order.desc("createdAt")));
		List<CashEntryDto> rows = toDtos(found.stream()
			.filter(e -> q.isEmpty() || InvoiceService.fold(e.getDescription()).contains(q))
			.toList());
		return InvoiceService.paginate(rows, pageable.isPaged() ? pageable : PageRequest.of(0, 100));
	}

	@Transactional(readOnly = true)
	public CashSummary summary(LocalDate from, LocalDate to) {
		Collection<UUID> schoolIds = viewableSchools();
		List<CashEntry> found = entries.findAll(spec(schoolIds, new EntryFilter(from, to, null, null, null)));
		Map<UUID, CashCategory> cats = categoryMap();
		Map<UUID, BigDecimal> byCategory = new LinkedHashMap<>();
		for (CashEntry e : found) {
			byCategory.merge(e.getCategoryId(), e.getAmount(), BigDecimal::add);
		}
		List<CategoryTotal> totals = new ArrayList<>();
		byCategory.forEach((id, amount) -> {
			CashCategory c = cats.get(id);
			totals.add(new CategoryTotal(id, c == null ? "" : c.getName(),
					c == null ? Direction.OUT : c.getDirection(), amount));
		});
		totals.sort(Comparator.comparing(CategoryTotal::direction)
			.thenComparing(Comparator.comparing(CategoryTotal::amount).reversed()));
		BigDecimal in = total(found, Direction.IN);
		BigDecimal out = total(found, Direction.OUT);
		return new CashSummary(in, out, in.subtract(out), totals);
	}

	public CashEntryDto create(CashEntryRequest r) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		CashCategory category = manualCategory(r.categoryId());
		UUID fileId = r.fileId() == null ? null : files.requireAttachable(r.fileId()).getId();
		CashEntry entry = new CashEntry(schoolId, CashSource.MANUAL, null);
		entry.update(category.getId(), category.getDirection(), r.amount(), r.entryDate(), r.description().trim(),
				fileId);
		entries.save(entry);
		audit.record("cash_entries", entry.getId(), Action.CREATE, null, snapshot(entry));
		return toDtos(List.of(entry)).get(0);
	}

	public CashEntryDto update(UUID id, CashEntryRequest r) {
		CashEntry entry = findManual(id);
		CashCategory category = manualCategory(r.categoryId());
		UUID fileId = r.fileId() == null ? null
				: r.fileId().equals(entry.getFileId()) ? r.fileId() : files.requireAttachable(r.fileId()).getId();
		Map<String, Object> before = snapshot(entry);
		entry.update(category.getId(), category.getDirection(), r.amount(), r.entryDate(), r.description().trim(),
				fileId);
		audit.record("cash_entries", id, Action.UPDATE, before, snapshot(entry));
		return toDtos(List.of(entry)).get(0);
	}

	public void delete(UUID id) {
		CashEntry entry = findManual(id);
		audit.record("cash_entries", id, Action.DELETE, snapshot(entry), null);
		entries.delete(entry);
	}

	@Transactional(readOnly = true)
	public DownloadUrlResponse fileUrl(UUID id) {
		CashEntry entry = find(id);
		if (entry.getFileId() == null) {
			throw ApiException.notFound("Dòng thu chi không có chứng từ đính kèm.");
		}
		StoredFile file = files.findForModule(List.of(entry.getFileId())).get(entry.getFileId());
		if (file == null) {
			throw ApiException.notFound("Không tìm thấy tệp.");
		}
		return files.presignDownload(file, true);
	}

	private CashEntry find(UUID id) {
		return entries.findById(id)
			.filter(e -> access.canView(e.getSchoolId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy dòng thu chi."));
	}

	private CashEntry findManual(UUID id) {
		CashEntry entry = find(id);
		access.requireManage(entry.getSchoolId());
		if (!entry.isManual()) {
			throw ApiException.conflict("CASH_ENTRY_SYSTEM",
					"Dòng tự sinh từ thanh toán học phí hoặc lương, sửa ở phiếu thu hoặc bảng lương.");
		}
		return entry;
	}

	private CashCategory manualCategory(UUID id) {
		CashCategory category = categories.findById(id).orElse(null);
		if (category == null || category.isSystem() || !category.isActive()) {
			throw ApiException.badRequest("VALIDATION_FAILED", "Danh mục không hợp lệ.")
				.withFieldErrors(List.of(Map.of("field", "categoryId", "message", "Vui lòng chọn danh mục khác.")));
		}
		return category;
	}

	private Collection<UUID> viewableSchools() {
		access.requireViewAny();
		UUID selected = SchoolScope.require().selectedSchoolId();
		if (selected != null) {
			access.requireView(selected);
			return List.of(selected);
		}
		return SchoolScope.require().effectiveSchoolIds().stream().filter(access::canView).toList();
	}

	private static Specification<CashEntry> spec(Collection<UUID> schoolIds, EntryFilter f) {
		return (root, query, cb) -> {
			List<Predicate> p = new ArrayList<>();
			p.add(root.get("schoolId").in(schoolIds));
			if (f.from() != null) {
				p.add(cb.greaterThanOrEqualTo(root.get("entryDate"), f.from()));
			}
			if (f.to() != null) {
				p.add(cb.lessThanOrEqualTo(root.get("entryDate"), f.to()));
			}
			if (f.direction() != null) {
				p.add(cb.equal(root.get("direction"), f.direction()));
			}
			if (f.categoryId() != null) {
				p.add(cb.equal(root.get("categoryId"), f.categoryId()));
			}
			return cb.and(p.toArray(Predicate[]::new));
		};
	}

	private List<CashEntryDto> toDtos(List<CashEntry> list) {
		if (list.isEmpty()) {
			return List.of();
		}
		Map<UUID, CashCategory> cats = categoryMap();
		Map<UUID, UUID> invoiceByPayment = payments
			.findAllById(list.stream()
				.filter(e -> e.getSource() == CashSource.PAYMENT)
				.map(CashEntry::getSourceId)
				.collect(Collectors.toSet()))
			.stream()
			.collect(Collectors.toMap(Payment::getId, Payment::getInvoiceId));
		Map<UUID, String> names = users
			.findAllById(list.stream().map(CashEntry::getCreatedBy).filter(Objects::nonNull).collect(Collectors.toSet()))
			.stream()
			.collect(Collectors.toMap(User::getId, User::getFullName));
		return list.stream().map(e -> {
			CashCategory c = cats.get(e.getCategoryId());
			return new CashEntryDto(e.getId(), e.getSchoolId(), e.getCategoryId(), c == null ? "" : c.getName(),
					e.getDirection(), e.getAmount(), e.getEntryDate(), e.getDescription(), e.getSource(),
					e.getSource() == CashSource.PAYMENT ? invoiceByPayment.get(e.getSourceId()) : null, e.getFileId(),
					names.get(e.getCreatedBy()));
		}).toList();
	}

	private Map<UUID, CashCategory> categoryMap() {
		return categories.findAll().stream().collect(Collectors.toMap(CashCategory::getId, Function.identity()));
	}

	private static BigDecimal total(List<CashEntry> list, Direction direction) {
		return list.stream()
			.filter(e -> e.getDirection() == direction)
			.map(CashEntry::getAmount)
			.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static Map<String, Object> snapshot(CashEntry e) {
		return Map.of("categoryId", e.getCategoryId(), "direction", e.getDirection(), "amount", e.getAmount(),
				"entryDate", e.getEntryDate(), "description", e.getDescription());
	}

}
