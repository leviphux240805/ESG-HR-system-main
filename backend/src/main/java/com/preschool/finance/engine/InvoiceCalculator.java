package com.preschool.finance.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.preschool.finance.entity.FinanceEnums.CalcMethod;
import com.preschool.finance.entity.FinanceEnums.LineKind;
import com.preschool.finance.entity.FinanceEnums.MealRefundRule;
import com.preschool.finance.entity.FinanceEnums.Proration;

/**
 * Lập các dòng phiếu thu tháng của một trẻ. Thuần Java, không chạm DB: dịch vụ chuẩn bị lịch học, các đoạn xếp lớp,
 * bảng giá, miễn giảm, ngày vắng tháng trước và số dư kỳ trước; lớp này chỉ tính.
 *
 * <p>Thứ tự dòng: khoản thu (theo thứ tự khoản thu), miễn giảm, hoàn tiền tháng trước, số dư kỳ trước.
 * <ul>
 * <li>MONTHLY, OPTIONAL: giá tháng; nhập/nghỉ giữa tháng thì theo {@link Proration} (theo ngày học hoặc trọn tháng),
 * mỗi đoạn xếp lớp lấy giá theo nhóm tuổi của lớp đó.</li>
 * <li>PER_DAY: số ngày học trong tháng mà trẻ đang ở lớp × đơn giá (thu trước, hoàn sau).</li>
 * <li>ONE_TIME: thu một lần trong năm học, ở phiếu đầu tiên chưa có khoản đó.</li>
 * <li>Miễn giảm theo % hoặc số tiền, không vượt quá phần còn lại của khoản được giảm.</li>
 * <li>Hoàn: ngày vắng có phép tháng trước theo {@link MealRefundRule}, không quá số ngày đã thu, theo đơn giá đã thu.</li>
 * </ul>
 * Mọi số tiền làm tròn tới đồng (HALF_UP).
 */
public final class InvoiceCalculator {

	private InvoiceCalculator() {
	}

	public record Fee(UUID feeTypeId, String name, CalcMethod method) {
	}

	/** Một đoạn trẻ ở một lớp trong tháng (đã cắt theo tháng), với số ngày học của đoạn. */
	public record Segment(UUID classId, UUID ageGroupId, LocalDate from, LocalDate to, int schoolDays) {
	}

	/** Giá hiệu lực của khoản thu cho nhóm tuổi; null = chưa có biểu phí. */
	@FunctionalInterface
	public interface PriceBook {

		BigDecimal price(UUID feeTypeId, UUID ageGroupId);

	}

	/** Miễn giảm còn hiệu lực trong tháng; {@code feeTypeId} rỗng = giảm trên tổng các khoản. */
	public record Discount(UUID feeTypeId, BigDecimal percent, BigDecimal amount, String reason) {
	}

	/** Một ngày vắng có phép; {@code reportedBeforeCutoff} = báo trước giờ chốt suất ăn của ngày đó. */
	public record Absence(LocalDate date, boolean reportedBeforeCutoff) {
	}

	/** Khoản tính theo ngày đã thu ở phiếu tháng trước, cùng ngày vắng có phép của tháng đó. */
	public record RefundSource(UUID feeTypeId, String name, BigDecimal chargedDays, BigDecimal unitPrice,
			List<Absence> absences) {
	}

	public record Input(LocalDate month, int monthSchoolDays, List<Segment> segments, List<Fee> fees, PriceBook prices,
			Proration proration, Set<UUID> optionalFeeTypeIds, Set<UUID> oneTimeAlreadyCharged,
			List<Discount> discounts, MealRefundRule refundRule, LocalDate refundMonth, List<RefundSource> refunds,
			BigDecimal carriedBalance) {
	}

	public record Line(UUID feeTypeId, LineKind kind, String description, BigDecimal quantity, BigDecimal unitPrice,
			BigDecimal amount, String note) {
	}

	public record Result(List<Line> lines, BigDecimal subtotal, BigDecimal discount, BigDecimal refund,
			BigDecimal carried, BigDecimal amountDue, List<String> warnings) {
	}

	public static Result calculate(Input in) {
		List<Line> lines = new ArrayList<>();
		List<String> warnings = new ArrayList<>();
		Map<UUID, BigDecimal> chargedByFee = new LinkedHashMap<>();
		List<Segment> segments = in.segments().stream().filter(s -> s.schoolDays() > 0).toList();

		for (Fee fee : in.fees()) {
			List<Line> feeLines = switch (fee.method()) {
				case MONTHLY -> monthly(fee, in, segments, warnings);
				case OPTIONAL -> in.optionalFeeTypeIds().contains(fee.feeTypeId()) ? monthly(fee, in, segments, warnings)
						: List.of();
				case PER_DAY -> perDay(fee, in, segments, warnings);
				case ONE_TIME -> in.oneTimeAlreadyCharged().contains(fee.feeTypeId()) ? List.of()
						: oneTime(fee, in, segments, warnings);
			};
			for (Line l : feeLines) {
				lines.add(l);
				chargedByFee.merge(fee.feeTypeId(), l.amount(), BigDecimal::add);
			}
		}

		lines.addAll(discounts(in, chargedByFee));
		lines.addAll(refunds(in));

		BigDecimal carried = round(in.carriedBalance() == null ? BigDecimal.ZERO : in.carriedBalance());
		if (carried.signum() != 0) {
			String description = carried.signum() > 0 ? "Nợ kỳ trước" : "Trả thừa kỳ trước";
			lines.add(new Line(null, LineKind.CARRIED, description, BigDecimal.ONE, carried, carried, null));
		}

		BigDecimal subtotal = sum(lines, LineKind.CHARGE);
		BigDecimal discount = sum(lines, LineKind.DISCOUNT).negate();
		BigDecimal refund = sum(lines, LineKind.REFUND).negate();
		BigDecimal due = subtotal.subtract(discount).subtract(refund).add(carried);
		return new Result(List.copyOf(lines), subtotal, discount, refund, carried, due, List.copyOf(warnings));
	}

	private static List<Line> monthly(Fee fee, Input in, List<Segment> segments, List<String> warnings) {
		if (segments.isEmpty()) {
			return List.of();
		}
		if (in.proration() == Proration.FULL_MONTH) {
			BigDecimal price = price(fee, in, segments.get(0), warnings);
			return price == null ? List.of() : List.of(charge(fee, BigDecimal.ONE, price, price, null));
		}
		List<Line> lines = new ArrayList<>();
		daysByPrice(fee, in, segments, warnings).forEach((price, days) -> {
			if (days >= in.monthSchoolDays()) {
				lines.add(charge(fee, BigDecimal.ONE, price, price, null));
				return;
			}
			BigDecimal amount = round(price.multiply(BigDecimal.valueOf(days))
				.divide(BigDecimal.valueOf(in.monthSchoolDays()), 6, RoundingMode.HALF_UP));
			lines.add(charge(fee, BigDecimal.ONE, amount, amount,
					days + "/" + in.monthSchoolDays() + " ngày học, giá tháng " + price.toPlainString()));
		});
		return lines;
	}

	private static List<Line> perDay(Fee fee, Input in, List<Segment> segments, List<String> warnings) {
		List<Line> lines = new ArrayList<>();
		daysByPrice(fee, in, segments, warnings).forEach((price, days) -> {
			BigDecimal qty = BigDecimal.valueOf(days);
			lines.add(charge(fee, qty, price, price.multiply(qty), null));
		});
		return lines;
	}

	/** Số ngày học theo từng mức giá: đổi lớp cùng nhóm tuổi gộp lại thành một dòng. */
	private static Map<BigDecimal, Integer> daysByPrice(Fee fee, Input in, List<Segment> segments,
			List<String> warnings) {
		Map<BigDecimal, Integer> result = new LinkedHashMap<>();
		for (Segment s : segments) {
			BigDecimal price = price(fee, in, s, warnings);
			if (price != null) {
				result.merge(round(price), s.schoolDays(), Integer::sum);
			}
		}
		return result;
	}

	private static List<Line> oneTime(Fee fee, Input in, List<Segment> segments, List<String> warnings) {
		if (segments.isEmpty()) {
			return List.of();
		}
		BigDecimal price = price(fee, in, segments.get(0), warnings);
		return price == null ? List.of() : List.of(charge(fee, BigDecimal.ONE, price, price, null));
	}

	private static List<Line> discounts(Input in, Map<UUID, BigDecimal> chargedByFee) {
		Map<UUID, BigDecimal> remaining = new LinkedHashMap<>(chargedByFee);
		List<Line> lines = new ArrayList<>();
		for (Discount d : in.discounts()) {
			BigDecimal base = d.feeTypeId() == null ? total(remaining)
					: remaining.getOrDefault(d.feeTypeId(), BigDecimal.ZERO);
			if (base.signum() <= 0) {
				continue;
			}
			BigDecimal value = d.percent() != null
					? round(base.multiply(d.percent()).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP))
					: round(d.amount());
			value = value.min(base);
			if (value.signum() <= 0) {
				continue;
			}
			consume(remaining, d.feeTypeId(), value);
			String note = d.percent() != null ? d.percent().stripTrailingZeros().toPlainString() + "%" : null;
			lines.add(new Line(d.feeTypeId(), LineKind.DISCOUNT, "Miễn giảm: " + d.reason(), BigDecimal.ONE,
					value.negate(), value.negate(), note));
		}
		return lines;
	}

	/** Trừ phần đã giảm vào phần còn lại; giảm trên tổng thì trừ lần lượt từng khoản. */
	private static void consume(Map<UUID, BigDecimal> remaining, UUID feeTypeId, BigDecimal value) {
		if (feeTypeId != null) {
			remaining.merge(feeTypeId, value.negate(), BigDecimal::add);
			return;
		}
		BigDecimal left = value;
		for (Map.Entry<UUID, BigDecimal> e : remaining.entrySet()) {
			BigDecimal take = left.min(e.getValue().max(BigDecimal.ZERO));
			e.setValue(e.getValue().subtract(take));
			left = left.subtract(take);
		}
	}

	private static List<Line> refunds(Input in) {
		if (in.refundRule() == MealRefundRule.NONE || in.refunds() == null) {
			return List.of();
		}
		List<Line> lines = new ArrayList<>();
		for (RefundSource r : in.refunds()) {
			long counted = r.absences()
				.stream()
				.filter(a -> in.refundRule() == MealRefundRule.ALL_EXCUSED || a.reportedBeforeCutoff())
				.count();
			BigDecimal days = BigDecimal.valueOf(counted).min(r.chargedDays());
			if (days.signum() <= 0) {
				continue;
			}
			BigDecimal unit = round(r.unitPrice());
			String month = in.refundMonth() == null ? ""
					: " tháng " + in.refundMonth().getMonthValue() + "/" + in.refundMonth().getYear();
			lines.add(new Line(r.feeTypeId(), LineKind.REFUND, "Hoàn " + r.name().toLowerCase() + month, days,
					unit.negate(), round(days.multiply(unit)).negate(), days.toPlainString() + " ngày vắng có phép"));
		}
		return lines;
	}

	private static BigDecimal price(Fee fee, Input in, Segment s, List<String> warnings) {
		BigDecimal p = in.prices().price(fee.feeTypeId(), s.ageGroupId());
		if (p == null) {
			String w = "Chưa có biểu phí \"" + fee.name() + "\" cho lớp của trẻ";
			if (!warnings.contains(w)) {
				warnings.add(w);
			}
		}
		return p;
	}

	private static Line charge(Fee fee, BigDecimal qty, BigDecimal unitPrice, BigDecimal amount, String note) {
		return new Line(fee.feeTypeId(), LineKind.CHARGE, fee.name(), qty, round(unitPrice), round(amount), note);
	}

	private static BigDecimal sum(List<Line> lines, LineKind kind) {
		return lines.stream().filter(l -> l.kind() == kind).map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static BigDecimal total(Map<UUID, BigDecimal> m) {
		return m.values().stream().map(v -> v.max(BigDecimal.ZERO)).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static BigDecimal round(BigDecimal v) {
		return v.setScale(0, RoundingMode.HALF_UP);
	}

}
