package com.preschool.finance.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.preschool.finance.engine.InvoiceCalculator.Absence;
import com.preschool.finance.engine.InvoiceCalculator.Discount;
import com.preschool.finance.engine.InvoiceCalculator.Fee;
import com.preschool.finance.engine.InvoiceCalculator.Input;
import com.preschool.finance.engine.InvoiceCalculator.Line;
import com.preschool.finance.engine.InvoiceCalculator.RefundSource;
import com.preschool.finance.engine.InvoiceCalculator.Result;
import com.preschool.finance.engine.InvoiceCalculator.Segment;
import com.preschool.finance.entity.FinanceEnums.CalcMethod;
import com.preschool.finance.entity.FinanceEnums.InvoiceStatus;
import com.preschool.finance.entity.FinanceEnums.LineKind;
import com.preschool.finance.entity.FinanceEnums.MealRefundRule;
import com.preschool.finance.entity.FinanceEnums.Proration;
import com.preschool.finance.entity.Invoice;
import com.preschool.finance.entity.InvoiceLine;

import org.junit.jupiter.api.Test;

/**
 * Sinh phiếu thu: tháng 10/2026 có 22 ngày học; học phí Mầm 4.200.000, Nhà trẻ 3.900.000; tiền ăn 35.000/ngày;
 * CSVC 1.500.000 (một lần/năm học); năng khiếu 400.000 (tự chọn). Số mong đợi tính tay trong chú thích.
 */
class InvoiceCalculatorTests {

	private static final LocalDate OCT = LocalDate.of(2026, 10, 1);

	private static final LocalDate SEP = LocalDate.of(2026, 9, 1);

	private static final UUID HOC_PHI = UUID.randomUUID();

	private static final UUID TIEN_AN = UUID.randomUUID();

	private static final UUID CSVC = UUID.randomUUID();

	private static final UUID NANG_KHIEU = UUID.randomUUID();

	private static final UUID MAM = UUID.randomUUID();

	private static final UUID NHA_TRE = UUID.randomUUID();

	private static final UUID CLASS_1 = UUID.randomUUID();

	private static final UUID CLASS_2 = UUID.randomUUID();

	private static final List<Fee> FEES = List.of(new Fee(HOC_PHI, "Học phí", CalcMethod.MONTHLY),
			new Fee(TIEN_AN, "Tiền ăn", CalcMethod.PER_DAY), new Fee(CSVC, "Cơ sở vật chất", CalcMethod.ONE_TIME),
			new Fee(NANG_KHIEU, "Năng khiếu", CalcMethod.OPTIONAL));

	private static final Map<UUID, Map<UUID, Long>> PRICES = Map.of(HOC_PHI, Map.of(MAM, 4_200_000L, NHA_TRE, 3_900_000L),
			TIEN_AN, Map.of(MAM, 35_000L, NHA_TRE, 35_000L), CSVC, Map.of(MAM, 1_500_000L, NHA_TRE, 1_500_000L),
			NANG_KHIEU, Map.of(MAM, 400_000L, NHA_TRE, 400_000L));

	private static BigDecimal vnd(long v) {
		return BigDecimal.valueOf(v);
	}

	private static Segment seg(UUID classId, UUID ageGroup, int days) {
		return new Segment(classId, ageGroup, OCT, OCT.plusMonths(1).minusDays(1), days);
	}

	private static Builder input(Segment... segments) {
		return new Builder(List.of(segments));
	}

	private static final class Builder {

		List<Segment> segments;

		Proration proration = Proration.BY_SCHOOL_DAYS;

		Set<UUID> optional = Set.of();

		Set<UUID> oneTimeCharged = Set.of(CSVC);

		List<Discount> discounts = List.of();

		MealRefundRule rule = MealRefundRule.BEFORE_CUTOFF;

		List<RefundSource> refunds = List.of();

		BigDecimal carried = BigDecimal.ZERO;

		Builder(List<Segment> segments) {
			this.segments = segments;
		}

		Result calc() {
			return InvoiceCalculator.calculate(new Input(OCT, 22, segments, FEES, (fee, age) -> {
				Long p = PRICES.getOrDefault(fee, Map.of()).get(age);
				return p == null ? null : vnd(p);
			}, proration, optional, oneTimeCharged, discounts, rule, SEP, refunds, carried));
		}

	}

	private static List<Line> lines(Result r, UUID feeTypeId, LineKind kind) {
		return r.lines().stream().filter(l -> kind == l.kind() && feeTypeId.equals(l.feeTypeId())).toList();
	}

	private static BigDecimal amount(Result r, UUID feeTypeId, LineKind kind) {
		return lines(r, feeTypeId, kind).stream().map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	@Test
	void fullMonthFirstInvoiceChargesOneTimeFee() {
		Builder b = input(seg(CLASS_1, MAM, 22));
		b.oneTimeCharged = Set.of();
		Result r = b.calc();

		// 4.200.000 + 22 × 35.000 + 1.500.000 = 6.470.000; năng khiếu không đăng ký
		assertThat(amount(r, HOC_PHI, LineKind.CHARGE)).isEqualByComparingTo("4200000");
		assertThat(lines(r, TIEN_AN, LineKind.CHARGE)).singleElement()
			.satisfies(l -> assertThat(l.quantity()).isEqualByComparingTo("22"));
		assertThat(amount(r, CSVC, LineKind.CHARGE)).isEqualByComparingTo("1500000");
		assertThat(lines(r, NANG_KHIEU, LineKind.CHARGE)).isEmpty();
		assertThat(r.amountDue()).isEqualByComparingTo("6470000");
		assertThat(r.warnings()).isEmpty();
	}

	@Test
	void oneTimeFeeNotChargedTwiceAndOptionalFeeWhenRegistered() {
		Builder b = input(seg(CLASS_1, MAM, 22));
		b.optional = Set.of(NANG_KHIEU);
		Result r = b.calc();

		assertThat(lines(r, CSVC, LineKind.CHARGE)).isEmpty();
		assertThat(amount(r, NANG_KHIEU, LineKind.CHARGE)).isEqualByComparingTo("400000");
		// 4.200.000 + 770.000 + 400.000
		assertThat(r.amountDue()).isEqualByComparingTo("5370000");
	}

	@Test
	void enrollMidMonthProratesBySchoolDays() {
		Result r = input(seg(CLASS_1, MAM, 10)).calc();

		// 4.200.000 × 10 / 22 = 1.909.090,9 → 1.909.091; tiền ăn 10 × 35.000 = 350.000
		assertThat(lines(r, HOC_PHI, LineKind.CHARGE)).singleElement().satisfies(l -> {
			assertThat(l.amount()).isEqualByComparingTo("1909091");
			assertThat(l.note()).isEqualTo("10/22 ngày học, giá tháng 4200000");
		});
		assertThat(amount(r, TIEN_AN, LineKind.CHARGE)).isEqualByComparingTo("350000");
		assertThat(r.amountDue()).isEqualByComparingTo("2259091");
	}

	@Test
	void leaveMidMonthProratesAndFullMonthRuleChargesWholeMonth() {
		// nghỉ giữa tháng: học 11/22 ngày → 2.100.000
		assertThat(amount(input(seg(CLASS_1, MAM, 11)).calc(), HOC_PHI, LineKind.CHARGE)).isEqualByComparingTo("2100000");

		Builder full = input(seg(CLASS_1, MAM, 11));
		full.proration = Proration.FULL_MONTH;
		Result r = full.calc();
		assertThat(amount(r, HOC_PHI, LineKind.CHARGE)).isEqualByComparingTo("4200000");
		// tiền ăn luôn theo ngày học thực có
		assertThat(amount(r, TIEN_AN, LineKind.CHARGE)).isEqualByComparingTo("385000");
	}

	@Test
	void classTransferChangingAgeGroupSplitsTuition() {
		Result r = input(seg(CLASS_1, NHA_TRE, 12), seg(CLASS_2, MAM, 10)).calc();

		// 3.900.000 × 12/22 = 2.127.272,7 → 2.127.273; 4.200.000 × 10/22 → 1.909.091
		assertThat(lines(r, HOC_PHI, LineKind.CHARGE)).extracting(Line::amount)
			.usingElementComparator(BigDecimal::compareTo)
			.containsExactly(vnd(2_127_273), vnd(1_909_091));
		// cùng đơn giá tiền ăn → gộp một dòng 22 ngày
		assertThat(lines(r, TIEN_AN, LineKind.CHARGE)).singleElement()
			.satisfies(l -> assertThat(l.amount()).isEqualByComparingTo("770000"));
	}

	@Test
	void classTransferWithinSameAgeGroupIsOneFullLine() {
		Result r = input(seg(CLASS_1, MAM, 12), seg(CLASS_2, MAM, 10)).calc();

		assertThat(lines(r, HOC_PHI, LineKind.CHARGE)).singleElement().satisfies(l -> {
			assertThat(l.amount()).isEqualByComparingTo("4200000");
			assertThat(l.note()).isNull();
		});
	}

	@Test
	void notEnrolledInMonthOnlyCarriesBalance() {
		Builder b = input();
		b.carried = vnd(250_000);
		Result r = b.calc();

		assertThat(r.lines()).singleElement().satisfies(l -> assertThat(l.kind()).isEqualTo(LineKind.CARRIED));
		assertThat(r.amountDue()).isEqualByComparingTo("250000");
	}

	@Test
	void percentDiscountAppliesToItsFeeOnly() {
		Builder b = input(seg(CLASS_1, MAM, 22));
		b.discounts = List.of(new Discount(HOC_PHI, new BigDecimal("50"), null, "Con nhân viên"));
		Result r = b.calc();

		assertThat(lines(r, HOC_PHI, LineKind.DISCOUNT)).singleElement().satisfies(l -> {
			assertThat(l.amount()).isEqualByComparingTo("-2100000");
			assertThat(l.description()).isEqualTo("Miễn giảm: Con nhân viên");
			assertThat(l.note()).isEqualTo("50%");
		});
		assertThat(r.discount()).isEqualByComparingTo("2100000");
		// 4.200.000 + 770.000 − 2.100.000
		assertThat(r.amountDue()).isEqualByComparingTo("2870000");
	}

	@Test
	void fixedDiscountIsCappedAtTheLineAndStackedDiscountsAtTheRemainder() {
		Builder big = input(seg(CLASS_1, MAM, 22));
		big.discounts = List.of(new Discount(HOC_PHI, null, vnd(5_000_000), "Hỗ trợ"));
		assertThat(big.calc().discount()).isEqualByComparingTo("4200000");

		Builder stacked = input(seg(CLASS_1, MAM, 22));
		stacked.discounts = List.of(new Discount(HOC_PHI, new BigDecimal("50"), null, "Con nhân viên"),
				new Discount(HOC_PHI, null, vnd(3_000_000), "Hộ nghèo"));
		Result r = stacked.calc();
		// 2.100.000 + phần còn lại 2.100.000 (không phải 3.000.000)
		assertThat(lines(r, HOC_PHI, LineKind.DISCOUNT)).extracting(Line::amount)
			.usingElementComparator(BigDecimal::compareTo)
			.containsExactly(vnd(-2_100_000), vnd(-2_100_000));
		assertThat(r.amountDue()).isEqualByComparingTo("770000");
	}

	@Test
	void discountOnTotalUsesAllCharges() {
		Builder b = input(seg(CLASS_1, MAM, 10));
		b.discounts = List.of(new Discount(null, new BigDecimal("10"), null, "Anh chị em cùng học"));
		Result r = b.calc();

		// (1.909.091 + 350.000) × 10% = 225.909,1 → 225.909
		assertThat(r.discount()).isEqualByComparingTo("225909");
		assertThat(r.amountDue()).isEqualByComparingTo("2033182");
	}

	@Test
	void discountWithoutChargeOfThatFeeIsSkipped() {
		Builder b = input(seg(CLASS_1, MAM, 22));
		b.discounts = List.of(new Discount(NANG_KHIEU, new BigDecimal("100"), null, "Học bổng"));
		assertThat(b.calc().discount()).isEqualByComparingTo("0");
	}

	@Test
	void mealRefundBeforeCutoffCountsOnlyTimelyReports() {
		List<Absence> absences = List.of(new Absence(SEP.plusDays(7), true), new Absence(SEP.plusDays(8), true),
				new Absence(SEP.plusDays(9), false));
		Builder b = input(seg(CLASS_1, MAM, 22));
		b.refunds = List.of(new RefundSource(TIEN_AN, "Tiền ăn", vnd(20), vnd(35_000), absences));
		Result r = b.calc();

		// 2 ngày báo trước giờ chốt × 35.000 = 70.000
		assertThat(lines(r, TIEN_AN, LineKind.REFUND)).singleElement().satisfies(l -> {
			assertThat(l.quantity()).isEqualByComparingTo("2");
			assertThat(l.amount()).isEqualByComparingTo("-70000");
			assertThat(l.description()).isEqualTo("Hoàn tiền ăn tháng 9/2026");
		});
		assertThat(r.refund()).isEqualByComparingTo("70000");
		assertThat(r.amountDue()).isEqualByComparingTo("4900000");

		b.rule = MealRefundRule.ALL_EXCUSED;
		assertThat(b.calc().refund()).isEqualByComparingTo("105000");

		b.rule = MealRefundRule.NONE;
		assertThat(b.calc().refund()).isEqualByComparingTo("0");
	}

	@Test
	void mealRefundNeverExceedsChargedDaysAndUsesChargedPrice() {
		List<Absence> absences = List.of(new Absence(SEP.plusDays(20), true), new Absence(SEP.plusDays(21), true),
				new Absence(SEP.plusDays(22), true), new Absence(SEP.plusDays(23), true));
		Builder b = input(seg(CLASS_1, MAM, 22));
		// tháng trước nhập học muộn, chỉ thu 3 ngày với giá cũ 30.000
		b.refunds = List.of(new RefundSource(TIEN_AN, "Tiền ăn", vnd(3), vnd(30_000), absences));

		assertThat(b.calc().refund()).isEqualByComparingTo("90000");
	}

	@Test
	void previousDebtAndOverpaymentCarryIntoAmountDue() {
		Builder debt = input(seg(CLASS_1, MAM, 22));
		debt.carried = vnd(1_500_000);
		Result r = debt.calc();
		assertThat(r.lines()).last().satisfies(l -> {
			assertThat(l.kind()).isEqualTo(LineKind.CARRIED);
			assertThat(l.description()).isEqualTo("Nợ kỳ trước");
		});
		assertThat(r.amountDue()).isEqualByComparingTo("6470000");

		Builder over = input(seg(CLASS_1, MAM, 22));
		over.carried = vnd(-300_000);
		Result o = over.calc();
		assertThat(o.lines()).last().satisfies(l -> assertThat(l.description()).isEqualTo("Trả thừa kỳ trước"));
		assertThat(o.carried()).isEqualByComparingTo("-300000");
		assertThat(o.amountDue()).isEqualByComparingTo("4670000");
	}

	@Test
	void missingScheduleIsWarnedOnce() {
		Builder b = input(seg(CLASS_1, UUID.randomUUID(), 12), seg(CLASS_2, UUID.randomUUID(), 10));
		Result r = b.calc();

		assertThat(r.lines()).isEmpty();
		assertThat(r.warnings()).containsExactly("Chưa có biểu phí \"Học phí\" cho lớp của trẻ",
				"Chưa có biểu phí \"Tiền ăn\" cho lớp của trẻ");
	}

	// Thanh toán nhiều lần trên phiếu (trạng thái nằm ở entity)

	private static Invoice issued(Result r) {
		Invoice inv = new Invoice(UUID.randomUUID(), UUID.randomUUID(), OCT);
		List<InvoiceLine> lines = r.lines()
			.stream()
			.map(l -> new InvoiceLine(l.feeTypeId(), l.kind(), l.description(), l.quantity(), l.unitPrice(), l.amount(),
					l.note(), 0))
			.toList();
		inv.replaceLines(CLASS_1, OCT.plusDays(9), lines);
		inv.issue("HP2610-0001", Instant.now(), UUID.randomUUID());
		return inv;
	}

	@Test
	void underpaymentIsPartialThenPaid() {
		Invoice inv = issued(input(seg(CLASS_1, MAM, 22)).calc());
		assertThat(inv.getAmountDue()).isEqualByComparingTo("4970000");
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.ISSUED);

		inv.setAmountPaid(vnd(3_000_000));
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.PARTIAL);
		assertThat(inv.getBalance()).isEqualByComparingTo("1970000");

		inv.setAmountPaid(vnd(4_970_000));
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.PAID);
		assertThat(inv.getBalance()).isEqualByComparingTo("0");
	}

	@Test
	void overpaymentLeavesNegativeBalanceForNextMonth() {
		Invoice inv = issued(input(seg(CLASS_1, MAM, 22)).calc());
		inv.setAmountPaid(vnd(5_000_000));
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.PAID);
		assertThat(inv.getBalance()).isEqualByComparingTo("-30000");

		Builder next = input(seg(CLASS_1, MAM, 22));
		next.carried = inv.getBalance();
		assertThat(next.calc().amountDue()).isEqualByComparingTo("4940000");

		inv.carryTo(UUID.randomUUID());
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.CARRIED);
		assertThat(inv.isOpen()).isFalse();
		inv.reopen();
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.PAID);
	}

	@Test
	void invoiceFullyCoveredByCreditIsPaidAtIssue() {
		Builder b = input(seg(CLASS_1, MAM, 22));
		b.carried = vnd(-6_000_000);
		Invoice inv = issued(b.calc());

		assertThat(inv.getAmountDue()).isEqualByComparingTo("-1030000");
		assertThat(inv.getStatus()).isEqualTo(InvoiceStatus.PAID);
	}

}
