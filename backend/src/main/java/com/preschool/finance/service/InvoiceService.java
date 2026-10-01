package com.preschool.finance.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.classroom.entity.Child;
import com.preschool.classroom.entity.ChildAttendance;
import com.preschool.classroom.entity.ChildAttendanceConfig;
import com.preschool.classroom.entity.ClassEnrollment;
import com.preschool.classroom.entity.ClassEnums.AttendanceStatus;
import com.preschool.classroom.entity.ClassEnums.ChildStatus;
import com.preschool.classroom.entity.SchoolClass;
import com.preschool.classroom.repository.ChildAttendanceConfigRepository;
import com.preschool.classroom.repository.ChildAttendanceRepository;
import com.preschool.classroom.repository.ChildRepository;
import com.preschool.classroom.repository.ClassEnrollmentRepository;
import com.preschool.classroom.repository.SchoolClassRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.common.file.FileService;
import com.preschool.common.jobs.SchedulingConfig;
import com.preschool.common.text.Texts;
import com.preschool.common.web.PageResponse;
import com.preschool.finance.dto.CashDtos.ReceivableRow;
import com.preschool.finance.dto.CashDtos.ReceivableSummary;
import com.preschool.finance.dto.InvoiceDtos.CancelRequest;
import com.preschool.finance.dto.InvoiceDtos.GenerateRequest;
import com.preschool.finance.dto.InvoiceDtos.GenerateResult;
import com.preschool.finance.dto.InvoiceDtos.GenerateWarning;
import com.preschool.finance.dto.InvoiceDtos.InvoiceDetail;
import com.preschool.finance.dto.InvoiceDtos.InvoiceLineDto;
import com.preschool.finance.dto.InvoiceDtos.InvoiceRow;
import com.preschool.finance.dto.InvoiceDtos.InvoiceSummary;
import com.preschool.finance.dto.InvoiceDtos.IssueRequest;
import com.preschool.finance.dto.InvoiceDtos.IssueResult;
import com.preschool.finance.dto.InvoiceDtos.PaymentDto;
import com.preschool.finance.dto.InvoiceDtos.PaymentRequest;
import com.preschool.finance.dto.InvoiceDtos.VoidPaymentRequest;
import com.preschool.finance.engine.InvoiceCalculator;
import com.preschool.finance.engine.InvoiceCalculator.Absence;
import com.preschool.finance.engine.InvoiceCalculator.Discount;
import com.preschool.finance.engine.InvoiceCalculator.Fee;
import com.preschool.finance.engine.InvoiceCalculator.RefundSource;
import com.preschool.finance.engine.InvoiceCalculator.Segment;
import com.preschool.finance.entity.CashCategory;
import com.preschool.finance.entity.CashEntry;
import com.preschool.finance.entity.ChildDiscount;
import com.preschool.finance.entity.ChildFeeItem;
import com.preschool.finance.entity.FeeSchedule;
import com.preschool.finance.entity.FeeType;
import com.preschool.finance.entity.FinanceConfig;
import com.preschool.finance.entity.FinanceEnums.CalcMethod;
import com.preschool.finance.entity.FinanceEnums.CashSource;
import com.preschool.finance.entity.FinanceEnums.Direction;
import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.entity.FinanceEnums.LineKind;
import com.preschool.finance.entity.Invoice;
import com.preschool.finance.entity.InvoiceLine;
import com.preschool.finance.entity.Payment;
import com.preschool.finance.repository.CashCategoryRepository;
import com.preschool.finance.repository.CashEntryRepository;
import com.preschool.finance.repository.ChildDiscountRepository;
import com.preschool.finance.repository.ChildFeeItemRepository;
import com.preschool.finance.repository.FeeScheduleRepository;
import com.preschool.finance.repository.InvoiceRepository;
import com.preschool.finance.repository.PaymentRepository;
import com.preschool.school.entity.SchoolYear;
import com.preschool.school.repository.HolidayRepository;
import com.preschool.school.repository.SchoolYearRepository;
import com.preschool.security.SchoolScope;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phiếu thu: sinh phiếu nháp theo tháng (tính bằng {@link InvoiceCalculator}), phát hành (chốt số dư phiếu trước,
 * cấp số phiếu), hủy, thanh toán nhiều lần (mỗi lần tự ghi một dòng thu vào sổ thu chi).
 */
@Service
@Transactional
public class InvoiceService {

	private static final ZoneId VN = ZoneId.of(SchedulingConfig.ZONE);

	private static final LocalTime DEFAULT_CUTOFF = LocalTime.of(8, 30);

	private static final Set<InvoiceStatus> OPEN = EnumSet.of(InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL,
			InvoiceStatus.PAID);

	private static final DateTimeFormatter NO_MONTH = DateTimeFormatter.ofPattern("yyMM");

	private final FinanceAccess access;

	private final FeeCatalogService catalog;

	private final InvoiceRepository invoices;

	private final PaymentRepository payments;

	private final CashEntryRepository cashEntries;

	private final CashCategoryRepository cashCategories;

	private final FeeScheduleRepository schedules;

	private final ChildFeeItemRepository feeItems;

	private final ChildDiscountRepository discounts;

	private final ChildRepository children;

	private final ClassEnrollmentRepository enrollments;

	private final SchoolClassRepository classes;

	private final SchoolYearRepository schoolYears;

	private final ChildAttendanceRepository attendance;

	private final ChildAttendanceConfigRepository attendanceConfigs;

	private final HolidayRepository holidays;

	private final UserRepository users;

	private final FileService files;

	private final AuditService audit;

	private final Clock clock;

	public InvoiceService(FinanceAccess access, FeeCatalogService catalog, InvoiceRepository invoices,
			PaymentRepository payments, CashEntryRepository cashEntries, CashCategoryRepository cashCategories,
			FeeScheduleRepository schedules, ChildFeeItemRepository feeItems, ChildDiscountRepository discounts,
			ChildRepository children, ClassEnrollmentRepository enrollments, SchoolClassRepository classes,
			SchoolYearRepository schoolYears, ChildAttendanceRepository attendance,
			ChildAttendanceConfigRepository attendanceConfigs, HolidayRepository holidays, UserRepository users,
			FileService files, AuditService audit, Clock clock) {
		this.access = access;
		this.catalog = catalog;
		this.invoices = invoices;
		this.payments = payments;
		this.cashEntries = cashEntries;
		this.cashCategories = cashCategories;
		this.schedules = schedules;
		this.feeItems = feeItems;
		this.discounts = discounts;
		this.children = children;
		this.enrollments = enrollments;
		this.classes = classes;
		this.schoolYears = schoolYears;
		this.attendance = attendance;
		this.attendanceConfigs = attendanceConfigs;
		this.holidays = holidays;
		this.users = users;
		this.files = files;
		this.audit = audit;
		this.clock = clock;
	}

	// ------------------------------------------------------------ sinh phiếu

	/**
	 * Sinh (hoặc tính lại) phiếu nháp tháng {@code month} cho trẻ có đợt học ở cơ sở đang chọn. Phiếu đã phát hành giữ
	 * nguyên. Mỗi trẻ chỉ một phiếu mỗi tháng (ràng buộc duy nhất trong DB; phiên song song bị từ chối 409).
	 */
	public GenerateResult generate(GenerateRequest r) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		LocalDate month = FeeCatalogService.firstOfMonth(r.month());
		LocalDate end = endOfMonth(month);
		LocalDate refundMonth = month.minusMonths(1);
		FinanceConfig config = catalog.effectiveConfig(schoolId, month);

		Set<LocalDate> off = holidays.findByHolidayDateBetweenOrderByHolidayDate(refundMonth, end)
			.stream()
			.filter(h -> h.getSchoolId() == null || h.getSchoolId().equals(schoolId))
			.map(h -> h.getHolidayDate())
			.collect(Collectors.toSet());
		Predicate<LocalDate> schoolDay = d -> d.getDayOfWeek() != DayOfWeek.SUNDAY && !off.contains(d);

		Map<UUID, List<ClassEnrollment>> byChild = enrollments.findOverlapping(schoolId, month, end)
			.stream()
			.filter(e -> r.childIds() == null || r.childIds().isEmpty() || r.childIds().contains(e.getChildId()))
			.collect(Collectors.groupingBy(ClassEnrollment::getChildId));
		if (byChild.isEmpty()) {
			return new GenerateResult(0, 0, 0, List.of());
		}
		List<Child> kids = children.findAllById(byChild.keySet())
			.stream()
			.filter(c -> c.getStatus() != ChildStatus.RESERVED)
			.sorted(Comparator.comparing(Child::getFullName))
			.toList();
		Set<UUID> kidIds = kids.stream().map(Child::getId).collect(Collectors.toSet());
		Map<UUID, SchoolClass> classMap = classes
			.findAllById(byChild.values().stream().flatMap(List::stream).map(ClassEnrollment::getClassId).toList())
			.stream()
			.collect(Collectors.toMap(SchoolClass::getId, Function.identity()));
		Map<UUID, FeeType> types = catalog.feeTypeMap();
		List<Fee> fees = types.values()
			.stream()
			.filter(FeeType::isActive)
			.sorted(Comparator.comparingInt(FeeType::getOrderNo).thenComparing(FeeType::getName))
			.map(t -> new Fee(t.getId(), t.getName(), t.getCalcMethod()))
			.toList();
		List<FeeSchedule> prices = schedules.findBySchoolIdAndEffectiveFromLessThanEqual(schoolId, end);
		Map<UUID, List<ChildFeeItem>> items = feeItems.findByChildIdIn(kidIds)
			.stream()
			.collect(Collectors.groupingBy(ChildFeeItem::getChildId));
		Map<UUID, List<ChildDiscount>> childDiscounts = discounts.findByChildIdIn(kidIds)
			.stream()
			.collect(Collectors.groupingBy(ChildDiscount::getChildId));
		Map<UUID, List<ChildAttendance>> absences = attendance
			.findByChildIdInAndAttendDateBetween(kidIds, refundMonth, endOfMonth(refundMonth))
			.stream()
			.filter(a -> a.getStatus() == AttendanceStatus.EXCUSED)
			.collect(Collectors.groupingBy(ChildAttendance::getChildId));
		LocalTime cutoff = attendanceConfigs
			.findFirstBySchoolIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(schoolId, refundMonth)
			.or(() -> attendanceConfigs
				.findFirstBySchoolIdIsNullAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(refundMonth))
			.map(ChildAttendanceConfig::getMealCutoffTime)
			.orElse(DEFAULT_CUTOFF);
		Map<UUID, Invoice> existing = invoices.findActiveBySchoolAndMonth(schoolId, month)
			.stream()
			.collect(Collectors.toMap(Invoice::getChildId, Function.identity()));
		Map<UUID, SchoolYear> years = new HashMap<>();
		int monthSchoolDays = countDays(month, end, schoolDay);
		LocalDate dueDate = month.withDayOfMonth(config.getDueDay());

		int created = 0;
		int updated = 0;
		int skipped = 0;
		List<GenerateWarning> warnings = new ArrayList<>();
		for (Child child : kids) {
			Invoice invoice = existing.get(child.getId());
			if (invoice != null && invoice.getStatus() != InvoiceStatus.DRAFT) {
				skipped++;
				continue;
			}
			List<Segment> segments = byChild.get(child.getId())
				.stream()
				.sorted(Comparator.comparing(ClassEnrollment::getFromDate))
				.map(e -> {
					LocalDate from = e.getFromDate().isBefore(month) ? month : e.getFromDate();
					LocalDate to = e.getToDate() == null || e.getToDate().isAfter(end) ? end : e.getToDate();
					return new Segment(e.getClassId(), classMap.get(e.getClassId()).getAgeGroupId(), from, to,
							countDays(from, to, schoolDay));
				})
				.toList();
			UUID classId = segments.get(segments.size() - 1).classId();
			SchoolYear year = years.computeIfAbsent(classMap.get(classId).getSchoolYearId(),
					id -> schoolYears.findById(id).orElseThrow());
			List<Invoice> history = invoices.findByChildIdOrderByPeriodMonthDesc(child.getId())
				.stream()
				.filter(i -> i.getStatus() != InvoiceStatus.CANCELLED && !i.getPeriodMonth().equals(month))
				.toList();

			InvoiceCalculator.Input input = new InvoiceCalculator.Input(month, monthSchoolDays, segments, fees,
					(feeTypeId, ageGroupId) -> price(prices, year.getId(), feeTypeId, ageGroupId),
					config.getProration(),
					items.getOrDefault(child.getId(), List.of())
						.stream()
						.filter(i -> i.covers(month))
						.map(ChildFeeItem::getFeeTypeId)
						.collect(Collectors.toSet()),
					oneTimeCharged(history, types, year), childDiscounts.getOrDefault(child.getId(), List.of())
						.stream()
						.filter(d -> d.covers(month))
						.map(d -> new Discount(d.getFeeTypeId(), d.getPercent(), d.getAmount(), d.getReason()))
						.toList(),
					config.getMealRefundRule(), refundMonth,
					refundSources(history, refundMonth, types, absences.getOrDefault(child.getId(), List.of()), cutoff),
					history.stream()
						.filter(i -> OPEN.contains(i.getStatus()) && i.getPeriodMonth().isBefore(month))
						.map(Invoice::getBalance)
						.reduce(BigDecimal.ZERO, BigDecimal::add));
			InvoiceCalculator.Result result = InvoiceCalculator.calculate(input);
			result.warnings().forEach(w -> warnings.add(new GenerateWarning(child.getId(), child.getFullName(), w)));
			if (result.lines().stream().noneMatch(l -> l.kind() == LineKind.CHARGE)) {
				if (invoice != null) {
					invoice.softDelete(Instant.now(clock));
				}
				continue;
			}
			List<InvoiceLine> lines = new ArrayList<>();
			for (InvoiceCalculator.Line l : result.lines()) {
				lines.add(new InvoiceLine(l.feeTypeId(), l.kind(), l.description(), l.quantity(), l.unitPrice(),
						l.amount(), l.note(), lines.size()));
			}
			if (invoice == null) {
				invoice = new Invoice(schoolId, child.getId(), month);
				created++;
			}
			else {
				updated++;
			}
			invoice.replaceLines(classId, dueDate, lines);
			invoices.save(invoice);
		}
		flush("INVOICE_GENERATING", "Phiếu thu tháng này đang được sinh ở phiên khác, vui lòng thử lại.");
		return new GenerateResult(created, updated, skipped, warnings);
	}

	/** Mức phí hiệu lực mới nhất của năm học; dòng theo khối được ưu tiên hơn dòng áp dụng mọi khối. */
	private static BigDecimal price(List<FeeSchedule> prices, UUID yearId, UUID feeTypeId, UUID ageGroupId) {
		return prices.stream()
			.filter(s -> s.getSchoolYearId().equals(yearId) && s.getFeeTypeId().equals(feeTypeId)
					&& (s.getAgeGroupId() == null || s.getAgeGroupId().equals(ageGroupId)))
			.max(Comparator.comparing((FeeSchedule s) -> s.getAgeGroupId() != null)
				.thenComparing(FeeSchedule::getEffectiveFrom))
			.map(FeeSchedule::getAmount)
			.orElse(null);
	}

	/** Khoản một lần đã thu ở phiếu khác trong cùng năm học. */
	private static Set<UUID> oneTimeCharged(List<Invoice> history, Map<UUID, FeeType> types, SchoolYear year) {
		LocalDate from = year.getStartDate().withDayOfMonth(1);
		return history.stream()
			.filter(i -> !i.getPeriodMonth().isBefore(from) && !i.getPeriodMonth().isAfter(year.getEndDate()))
			.flatMap(i -> i.getLines().stream())
			.filter(l -> l.getKind() == LineKind.CHARGE && l.getFeeTypeId() != null
					&& types.get(l.getFeeTypeId()).getCalcMethod() == CalcMethod.ONE_TIME)
			.map(InvoiceLine::getFeeTypeId)
			.collect(Collectors.toSet());
	}

	/**
	 * Khoản tính theo ngày đã thu ở phiếu tháng trước, cùng ngày vắng có phép tháng đó. Báo trước giờ báo ăn = lần cập
	 * nhật cuối của dòng điểm danh không muộn hơn giờ báo ăn của ngày vắng.
	 */
	private static List<RefundSource> refundSources(List<Invoice> history, LocalDate refundMonth,
			Map<UUID, FeeType> types, List<ChildAttendance> excused, LocalTime cutoff) {
		Invoice previous = history.stream()
			.filter(i -> i.getPeriodMonth().equals(refundMonth))
			.findFirst()
			.orElse(null);
		if (previous == null) {
			return List.of();
		}
		List<Absence> absences = excused.stream()
			.sorted(Comparator.comparing(ChildAttendance::getAttendDate))
			.map(a -> new Absence(a.getAttendDate(), a.getUpdatedAt() == null || !a.getUpdatedAt()
				.isAfter(a.getAttendDate().atTime(cutoff).atZone(VN).toInstant())))
			.toList();
		Map<UUID, List<InvoiceLine>> byFee = new LinkedHashMap<>();
		previous.getLines()
			.stream()
			.filter(l -> l.getKind() == LineKind.CHARGE && l.getFeeTypeId() != null)
			.filter(l -> {
				FeeType t = types.get(l.getFeeTypeId());
				return t.isRefundableOnAbsence() && t.getCalcMethod() == CalcMethod.PER_DAY;
			})
			.forEach(l -> byFee.computeIfAbsent(l.getFeeTypeId(), k -> new ArrayList<>()).add(l));
		return byFee.entrySet()
			.stream()
			.map(e -> new RefundSource(e.getKey(), types.get(e.getKey()).getName(),
					e.getValue().stream().map(InvoiceLine::getQuantity).reduce(BigDecimal.ZERO, BigDecimal::add),
					e.getValue().get(e.getValue().size() - 1).getUnitPrice(), absences))
			.toList();
	}

	private static int countDays(LocalDate from, LocalDate to, Predicate<LocalDate> schoolDay) {
		return (int) from.datesUntil(to.plusDays(1)).filter(schoolDay).count();
	}

	private static LocalDate endOfMonth(LocalDate month) {
		return month.withDayOfMonth(month.lengthOfMonth());
	}

	// ------------------------------------------------------------ phát hành, hủy

	public InvoiceDetail issue(UUID id) {
		Invoice invoice = find(id);
		access.requireManage(invoice.getSchoolId());
		if (invoice.getStatus() != InvoiceStatus.DRAFT) {
			throw ApiException.conflict("INVOICE_NOT_DRAFT", "Phiếu đã được phát hành.");
		}
		String prefix = prefix(invoice.getPeriodMonth());
		issueOne(invoice, prefix, invoices.countByNoPrefix(invoice.getSchoolId(), prefix) + 1);
		flush("INVOICE_NO_TAKEN", "Số phiếu vừa được cấp ở phiên khác, vui lòng thử lại.");
		return detail(id);
	}

	/** Phát hành các phiếu nháp của tháng ở cơ sở đang chọn (hoặc các phiếu được chọn). */
	public IssueResult issueAll(IssueRequest r) {
		UUID schoolId = access.requireSelectedSchool();
		access.requireManage(schoolId);
		LocalDate month = FeeCatalogService.firstOfMonth(r.month());
		Map<UUID, Child> kids = new HashMap<>();
		List<Invoice> drafts = invoices.findActiveBySchoolAndMonth(schoolId, month)
			.stream()
			.filter(i -> i.getStatus() == InvoiceStatus.DRAFT)
			.filter(i -> r.ids() == null || r.ids().isEmpty() || r.ids().contains(i.getId()))
			.toList();
		children.findAllById(drafts.stream().map(Invoice::getChildId).toList()).forEach(c -> kids.put(c.getId(), c));
		String prefix = prefix(month);
		long seq = invoices.countByNoPrefix(schoolId, prefix);
		for (Invoice invoice : drafts.stream()
			.sorted(Comparator.comparing(i -> kids.get(i.getChildId()).getFullName()))
			.toList()) {
			issueOne(invoice, prefix, ++seq);
		}
		flush("INVOICE_NO_TAKEN", "Số phiếu vừa được cấp ở phiên khác, vui lòng thử lại.");
		return new IssueResult(drafts.size());
	}

	/** Chốt số dư các phiếu trước còn mở vào dòng "Nợ kỳ trước"/"Trả thừa kỳ trước", cấp số phiếu. */
	private void issueOne(Invoice invoice, String prefix, long seq) {
		List<Invoice> sources = invoices
			.findByChildIdAndStatusInAndPeriodMonthBefore(invoice.getChildId(), OPEN, invoice.getPeriodMonth())
			.stream()
			.filter(i -> i.getBalance().signum() != 0)
			.toList();
		BigDecimal carried = sources.stream().map(Invoice::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
		List<InvoiceLine> lines = new ArrayList<>();
		invoice.getLines()
			.stream()
			.filter(l -> l.getKind() != LineKind.CARRIED)
			.forEach(l -> lines.add(new InvoiceLine(l.getFeeTypeId(), l.getKind(), l.getDescription(), l.getQuantity(),
					l.getUnitPrice(), l.getAmount(), l.getNote(), lines.size())));
		if (carried.signum() != 0) {
			lines.add(new InvoiceLine(null, LineKind.CARRIED,
					carried.signum() > 0 ? "Nợ kỳ trước" : "Trả thừa kỳ trước", BigDecimal.ONE, carried, carried,
					sources.stream()
						.map(i -> i.getInvoiceNo() == null ? "" : i.getInvoiceNo())
						.collect(Collectors.joining(", ")),
					lines.size()));
		}
		invoice.replaceLines(invoice.getClassId(), invoice.getDueDate(), lines);
		invoice.issue(prefix + "%04d".formatted(seq), Instant.now(clock), access.myUserId());
		sources.forEach(s -> s.carryTo(invoice.getId()));
		audit.record("invoices", invoice.getId(), Action.UPDATE, null,
				Map.of("status", invoice.getStatus(), "invoiceNo", invoice.getInvoiceNo()));
	}

	private static String prefix(LocalDate month) {
		return "HP" + NO_MONTH.format(month) + "-";
	}

	/** Hủy phiếu: phiếu nháp bị xóa; phiếu đã phát hành cần lý do, chưa có thanh toán, chưa chuyển nợ sang phiếu sau. */
	public void cancel(UUID id, CancelRequest r) {
		Invoice invoice = find(id);
		access.requireManage(invoice.getSchoolId());
		switch (invoice.getStatus()) {
			case DRAFT -> {
				invoice.softDelete(Instant.now(clock));
				audit.record("invoices", id, Action.DELETE, Map.of("status", InvoiceStatus.DRAFT), null);
				return;
			}
			case CANCELLED -> throw ApiException.conflict("INVOICE_CANCELLED", "Phiếu đã bị hủy.");
			case CARRIED -> throw ApiException.conflict("INVOICE_CARRIED",
					"Số dư phiếu này đã chuyển sang phiếu tháng sau; hãy hủy phiếu tháng sau trước.");
			default -> {
			}
		}
		String reason = r == null ? null : blankToNull(r.reason());
		if (reason == null) {
			throw ApiException.badRequest("VALIDATION_FAILED", "Vui lòng nhập lý do hủy phiếu.")
				.withFieldErrors(List.of(Map.of("field", "reason", "message", "Vui lòng nhập lý do hủy phiếu.")));
		}
		if (payments.findByInvoiceIdOrderByPaidOnAscCreatedAtAsc(id).stream().anyMatch(p -> !p.isVoided())) {
			throw ApiException.conflict("INVOICE_HAS_PAYMENTS", "Phiếu đã có thanh toán; hãy hủy các lần thu trước.");
		}
		invoices.findByCarriedToId(id).forEach(Invoice::reopen);
		InvoiceStatus before = invoice.getStatus();
		invoice.cancel(reason, Instant.now(clock));
		audit.record("invoices", id, Action.UPDATE, Map.of("status", before),
				Map.of("status", InvoiceStatus.CANCELLED, "reason", reason));
	}

	// ------------------------------------------------------------ thanh toán

	public InvoiceDetail addPayment(UUID id, PaymentRequest r) {
		Invoice invoice = find(id);
		access.requireCollect(invoice.getSchoolId());
		if (!invoice.isOpen()) {
			throw ApiException.conflict("INVOICE_NOT_OPEN",
					"Chỉ ghi nhận thanh toán cho phiếu đã phát hành và chưa chuyển nợ sang tháng sau.");
		}
		if (r.paidOn().isAfter(today())) {
			throw ApiException.badRequest("VALIDATION_FAILED", "Ngày thu không được sau hôm nay.")
				.withFieldErrors(List.of(Map.of("field", "paidOn", "message", "Ngày thu không được sau hôm nay.")));
		}
		UUID fileId = r.fileId() == null ? null : files.requireAttachable(r.fileId()).getId();
		Payment payment = payments.save(new Payment(invoice.getSchoolId(), id, r.amount(), r.method(), r.paidOn(),
				blankToNull(r.reference()), blankToNull(r.note()), fileId, access.myUserId()));
		refreshPaid(invoice);
		CashCategory tuition = cashCategories.findBySystemCode(CashCategory.TUITION).orElseThrow();
		CashEntry entry = new CashEntry(invoice.getSchoolId(), CashSource.PAYMENT, payment.getId());
		String childName = children.findById(invoice.getChildId()).map(Child::getFullName).orElse("");
		entry.update(tuition.getId(), Direction.IN, r.amount(), r.paidOn(),
				"Thu học phí " + invoice.getInvoiceNo() + " – " + childName, fileId);
		cashEntries.save(entry);
		audit.record("payments", payment.getId(), Action.CREATE, null,
				Map.of("invoiceId", id, "amount", r.amount(), "method", r.method()));
		return detail(id);
	}

	public InvoiceDetail voidPayment(UUID id, UUID paymentId, VoidPaymentRequest r) {
		Invoice invoice = find(id);
		access.requireManage(invoice.getSchoolId());
		Payment payment = payments.findById(paymentId)
			.filter(p -> p.getInvoiceId().equals(id))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy lần thu."));
		if (payment.isVoided()) {
			throw ApiException.conflict("PAYMENT_VOIDED", "Lần thu này đã bị hủy.");
		}
		if (!invoice.isOpen()) {
			throw ApiException.conflict("INVOICE_NOT_OPEN",
					"Số dư phiếu đã chuyển sang phiếu tháng sau, không hủy được lần thu.");
		}
		payment.voidPayment(r.reason().trim(), Instant.now(clock), access.myUserId());
		refreshPaid(invoice);
		cashEntries.findBySourceAndSourceId(CashSource.PAYMENT, paymentId).ifPresent(cashEntries::delete);
		audit.record("payments", paymentId, Action.UPDATE, Map.of("voided", false),
				Map.of("voided", true, "reason", r.reason().trim()));
		return detail(id);
	}

	private void refreshPaid(Invoice invoice) {
		invoice.setAmountPaid(payments.findByInvoiceIdOrderByPaidOnAscCreatedAtAsc(invoice.getId())
			.stream()
			.filter(p -> !p.isVoided())
			.map(Payment::getAmount)
			.reduce(BigDecimal.ZERO, BigDecimal::add));
	}

	// ------------------------------------------------------------ xem

	public record ListFilter(LocalDate month, UUID classId, InvoiceStatus status, String q, Boolean overdue) {
	}

	@Transactional(readOnly = true)
	public PageResponse<InvoiceRow> list(ListFilter filter, Pageable pageable) {
		return paginate(rows(filter), pageable);
	}

	static <T> PageResponse<T> paginate(List<T> rows, Pageable pageable) {
		return PageResponse.slice(rows, pageable);
	}

	/** Phiếu của tháng theo bộ lọc, xếp theo lớp rồi tên trẻ (dùng cho danh sách và xuất Excel). */
	@Transactional(readOnly = true)
	public List<InvoiceRow> rows(ListFilter filter) {
		Collection<UUID> schoolIds = viewableSchools();
		LocalDate month = FeeCatalogService.firstOfMonth(filter.month());
		Specification<Invoice> spec = (root, query, cb) -> cb.and(root.get("schoolId").in(schoolIds),
				cb.equal(root.get("periodMonth"), month),
				filter.status() == null ? cb.notEqual(root.get("status"), InvoiceStatus.CANCELLED)
						: cb.equal(root.get("status"), filter.status()),
				filter.classId() == null ? cb.conjunction() : cb.equal(root.get("classId"), filter.classId()));
		String q = filter.q() == null ? "" : fold(filter.q().trim());
		return toRows(invoices.findAll(spec)).stream()
			.filter(row -> q.isEmpty() || fold(row.childName()).contains(q)
					|| (row.childCode() != null && fold(row.childCode()).contains(q))
					|| (row.invoiceNo() != null && fold(row.invoiceNo()).contains(q)))
			.filter(row -> !Boolean.TRUE.equals(filter.overdue()) || row.overdue())
			.sorted(Comparator.comparing((InvoiceRow row) -> Objects.toString(row.className(), ""))
				.thenComparing(InvoiceRow::childName))
			.toList();
	}

	@Transactional(readOnly = true)
	public InvoiceSummary summary(LocalDate month) {
		Collection<UUID> schoolIds = viewableSchools();
		LocalDate m = FeeCatalogService.firstOfMonth(month);
		List<Invoice> list = invoices.findAll((root, query, cb) -> cb.and(root.get("schoolId").in(schoolIds),
				cb.equal(root.get("periodMonth"), m), cb.notEqual(root.get("status"), InvoiceStatus.CANCELLED)));
		Map<InvoiceStatus, Long> count = list.stream()
			.collect(Collectors.groupingBy(Invoice::getStatus, Collectors.counting()));
		List<Invoice> issued = list.stream().filter(i -> i.getStatus() != InvoiceStatus.DRAFT).toList();
		return new InvoiceSummary(list.size(), count.getOrDefault(InvoiceStatus.DRAFT, 0L),
				count.getOrDefault(InvoiceStatus.ISSUED, 0L), count.getOrDefault(InvoiceStatus.PARTIAL, 0L),
				count.getOrDefault(InvoiceStatus.PAID, 0L), count.getOrDefault(InvoiceStatus.CARRIED, 0L),
				sum(issued, Invoice::getAmountDue), sum(issued, Invoice::getAmountPaid),
				sum(issued.stream().filter(Invoice::isOpen).toList(), Invoice::getBalance));
	}

	// ------------------------------------------------------------ công nợ

	public record ReceivableFilter(UUID classId, String q, Boolean overdue) {
	}

	@Transactional(readOnly = true)
	public PageResponse<ReceivableRow> receivables(ReceivableFilter filter, Pageable pageable) {
		return paginate(receivableRows(filter), pageable);
	}

	/** Toàn bộ công nợ theo bộ lọc, không phân trang (xuất Excel). */
	@Transactional(readOnly = true)
	public List<ReceivableRow> receivableList(ReceivableFilter filter) {
		return receivableRows(filter);
	}

	@Transactional(readOnly = true)
	public ReceivableSummary receivableSummary() {
		List<ReceivableRow> rows = receivableRows(new ReceivableFilter(null, null, null));
		List<ReceivableRow> late = rows.stream().filter(r -> r.overdueDays() > 0).toList();
		return new ReceivableSummary(rows.size(),
				rows.stream().map(ReceivableRow::balance).reduce(BigDecimal.ZERO, BigDecimal::add), late.size(),
				late.stream().map(ReceivableRow::balance).reduce(BigDecimal.ZERO, BigDecimal::add));
	}

	/**
	 * Nợ theo trẻ: cộng số dư các phiếu đang mở còn nợ. Trẻ trả thừa không có trong danh sách (số dư âm được trừ
	 * ở phiếu tháng sau). Lớp lấy theo phiếu mới nhất; nhiều nợ nhất trước.
	 */
	private List<ReceivableRow> receivableRows(ReceivableFilter filter) {
		Collection<UUID> schoolIds = viewableSchools();
		List<Invoice> open = invoices
			.findAll((root, query, cb) -> cb.and(root.get("schoolId").in(schoolIds), root.get("status").in(OPEN)))
			.stream()
			.filter(i -> i.getBalance().signum() > 0)
			.toList();
		LocalDate today = today();
		String q = filter.q() == null ? "" : fold(filter.q().trim());
		Map<UUID, List<InvoiceRow>> byChild = toRows(open).stream()
			.collect(Collectors.groupingBy(InvoiceRow::childId, LinkedHashMap::new, Collectors.toList()));
		List<ReceivableRow> result = new ArrayList<>();
		byChild.forEach((childId, list) -> {
			InvoiceRow latest = list.stream().max(Comparator.comparing(InvoiceRow::periodMonth)).orElseThrow();
			if (filter.classId() != null && !filter.classId().equals(latest.classId())) {
				return;
			}
			LocalDate oldestDue = list.stream()
				.map(InvoiceRow::dueDate)
				.filter(Objects::nonNull)
				.min(Comparator.naturalOrder())
				.orElse(null);
			int overdueDays = oldestDue == null || !today.isAfter(oldestDue) ? 0
					: (int) ChronoUnit.DAYS.between(oldestDue, today);
			result.add(new ReceivableRow(childId, latest.childName(), latest.childCode(), latest.schoolId(),
					latest.className(), list.size(),
					list.stream().map(InvoiceRow::balance).reduce(BigDecimal.ZERO, BigDecimal::add), oldestDue,
					overdueDays, latest.id()));
		});
		return result.stream()
			.filter(r -> q.isEmpty() || fold(r.childName()).contains(q)
					|| (r.childCode() != null && fold(r.childCode()).contains(q)))
			.filter(r -> !Boolean.TRUE.equals(filter.overdue()) || r.overdueDays() > 0)
			.sorted(Comparator.comparing(ReceivableRow::balance).reversed().thenComparing(ReceivableRow::childName))
			.toList();
	}

	/** Phiếu của một trẻ, mới nhất trước (tab Học phí trong hồ sơ trẻ). */
	@Transactional(readOnly = true)
	public List<InvoiceRow> childInvoices(UUID childId) {
		Child child = catalog.visibleChild(childId);
		return toRows(invoices.findByChildIdOrderByPeriodMonthDesc(child.getId()));
	}

	@Transactional(readOnly = true)
	public InvoiceDetail detail(UUID id) {
		Invoice invoice = find(id);
		List<Payment> list = payments.findByInvoiceIdOrderByPaidOnAscCreatedAtAsc(id);
		Map<UUID, String> names = users
			.findAllById(list.stream().map(Payment::getReceivedBy).filter(Objects::nonNull).collect(Collectors.toSet()))
			.stream()
			.collect(Collectors.toMap(User::getId, User::getFullName));
		String carriedToNo = invoice.getCarriedToId() == null ? null
				: invoices.findById(invoice.getCarriedToId()).map(Invoice::getInvoiceNo).orElse(null);
		return new InvoiceDetail(toRows(List.of(invoice)).get(0),
				invoice.getLines()
					.stream()
					.map(l -> new InvoiceLineDto(l.getFeeTypeId(), l.getKind(), l.getDescription(), l.getQuantity(),
							l.getUnitPrice(), l.getAmount(), l.getNote()))
					.toList(),
				list.stream()
					.map(p -> new PaymentDto(p.getId(), p.getAmount(), p.getMethod(), p.getPaidOn(), p.getReference(),
							p.getNote(), p.getFileId(), names.get(p.getReceivedBy()), p.getVoidedAt(),
							p.getVoidReason()))
					.toList(),
				invoice.getIssuedAt(), invoice.getNote(), invoice.getCancelReason(), invoice.getCarriedToId(),
				carriedToNo, access.canManage(invoice.getSchoolId()), access.canCollect(invoice.getSchoolId()));
	}

	/** Phiếu thuộc cơ sở người dùng được xem; ngoài phạm vi trả 404. */
	Invoice find(UUID id) {
		return invoices.findById(id)
			.filter(i -> access.canView(i.getSchoolId()))
			.orElseThrow(() -> ApiException.notFound("Không tìm thấy phiếu thu."));
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

	private List<InvoiceRow> toRows(List<Invoice> list) {
		if (list.isEmpty()) {
			return List.of();
		}
		Map<UUID, Child> kids = children.findAllById(list.stream().map(Invoice::getChildId).collect(Collectors.toSet()))
			.stream()
			.collect(Collectors.toMap(Child::getId, Function.identity()));
		Set<UUID> classIds = new HashSet<>();
		list.stream().map(Invoice::getClassId).filter(Objects::nonNull).forEach(classIds::add);
		Map<UUID, String> classNames = classes.findAllById(classIds)
			.stream()
			.collect(Collectors.toMap(SchoolClass::getId, SchoolClass::getName));
		LocalDate today = today();
		return list.stream().map(i -> {
			Child c = kids.get(i.getChildId());
			boolean overdue = i.isOpen() && i.getBalance().signum() > 0 && i.getDueDate() != null
					&& today.isAfter(i.getDueDate());
			return new InvoiceRow(i.getId(), i.getSchoolId(), i.getChildId(), c == null ? "" : c.getFullName(),
					c == null ? null : c.getChildCode(), i.getClassId(), classNames.get(i.getClassId()),
					i.getPeriodMonth(), i.getInvoiceNo(), i.getSubtotal(), i.getDiscount(), i.getRefund(),
					i.getCarriedBalance(), i.getAmountDue(), i.getAmountPaid(), i.getBalance(), i.getStatus(),
					i.getDueDate(), overdue);
		}).toList();
	}

	private LocalDate today() {
		return LocalDate.now(clock.withZone(VN));
	}

	private void flush(String code, String message) {
		try {
			invoices.flush();
		}
		catch (DataIntegrityViolationException e) {
			throw ApiException.conflict(code, message);
		}
	}

	private static BigDecimal sum(List<Invoice> list, Function<Invoice, BigDecimal> field) {
		return list.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	static String fold(String s) {
		return Texts.fold(s);
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s.trim();
	}

}
