import type { components } from "@/api/schema";
import type { ChildRec, DemoDB, InvoiceRec } from "./db";
import { isSchoolDay, monthDays, shiftMonthStr } from "./dates";

/**
 * Tính phiếu thu cho bản demo, rút gọn từ InvoiceService/InvoiceCalculator của backend: khoản theo tháng, theo ngày học,
 * một lần mỗi năm học, tự chọn; hoàn tiền ăn ngày vắng có phép tháng trước; miễn giảm; nợ/trả thừa kỳ trước khi phát hành.
 */

type S = components["schemas"];
type Line = S["InvoiceLineDto"];

export const TUITION_CATEGORY_ID = "cat-tuition";
export const PAYROLL_CATEGORY_ID = "cat-payroll";

const OPEN: InvoiceRec["status"][] = ["ISSUED", "PARTIAL", "PAID"];
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
const kindSum = (inv: InvoiceRec, kind: Line["kind"]) => sum(inv.lines.filter((l) => l.kind === kind).map((l) => l.amount));

export const isOpen = (inv: InvoiceRec) => OPEN.includes(inv.status);
export const amountDue = (inv: InvoiceRec) => sum(inv.lines.map((l) => l.amount));
export const amountPaid = (inv: InvoiceRec) => sum(inv.payments.filter((p) => !p.voidedAt).map((p) => p.amount));
export const balanceOf = (inv: InvoiceRec) => amountDue(inv) - amountPaid(inv);

const monthEndOf = (month: string) => monthDays(month).at(-1)!;
const covers = (from: string, to: string | undefined, periodMonth: string) =>
  from.slice(0, 7) <= periodMonth.slice(0, 7) && (!to || to.slice(0, 7) >= periodMonth.slice(0, 7));

export function refreshStatus(inv: InvoiceRec) {
  if (!isOpen(inv)) return;
  const paid = amountPaid(inv);
  inv.status = paid >= amountDue(inv) ? "PAID" : paid > 0 ? "PARTIAL" : "ISSUED";
}

export function toRow(d: DemoDB, inv: InvoiceRec, today: string): S["InvoiceRow"] {
  const child = d.children.find((c) => c.id === inv.childId);
  const balance = balanceOf(inv);
  return {
    id: inv.id,
    schoolId: inv.schoolId,
    childId: inv.childId,
    childName: child?.fullName ?? "",
    childCode: child?.code,
    classId: inv.classId,
    className: d.classes.find((c) => c.id === inv.classId)?.name,
    periodMonth: inv.periodMonth,
    invoiceNo: inv.invoiceNo,
    subtotal: kindSum(inv, "CHARGE"),
    discount: -kindSum(inv, "DISCOUNT"),
    refund: -kindSum(inv, "REFUND"),
    carriedBalance: kindSum(inv, "CARRIED"),
    amountDue: amountDue(inv),
    amountPaid: amountPaid(inv),
    balance,
    status: inv.status,
    dueDate: inv.dueDate,
    overdue: isOpen(inv) && balance > 0 && today > inv.dueDate,
  };
}

export function schoolYearFor(d: DemoDB, month: string) {
  const start = `${month}-01`;
  return d.schoolYears
    .filter((y) => y.startDate <= monthEndOf(month) && y.endDate >= start)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export function configFor(d: DemoDB, schoolId: string, month: string) {
  return d.financeConfigs
    .filter((c) => (!c.schoolId || c.schoolId === schoolId) && c.effectiveFrom <= monthEndOf(month))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || (b.schoolId ? 1 : 0) - (a.schoolId ? 1 : 0))[0];
}

function priceFor(d: DemoDB, schoolId: string, schoolYearId: string, feeTypeId: string, ageGroupId: string | undefined, month: string) {
  return d.feeSchedules
    .filter(
      (s) =>
        s.schoolId === schoolId &&
        s.schoolYearId === schoolYearId &&
        s.feeTypeId === feeTypeId &&
        (!s.ageGroupId || s.ageGroupId === ageGroupId) &&
        s.effectiveFrom <= monthEndOf(month),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || (b.ageGroupId ? 1 : 0) - (a.ageGroupId ? 1 : 0))[0]?.amount;
}

const activeInvoice = (d: DemoDB, childId: string, month: string) =>
  d.invoices.find((i) => i.childId === childId && i.periodMonth === `${month}-01` && i.status !== "CANCELLED");

/** Các dòng phiếu của trẻ trong tháng "YYYY-MM" (chưa gồm nợ kỳ trước). */
export function calculate(d: DemoDB, child: ChildRec, month: string): { lines: Line[]; warnings: string[] } {
  const lines: Line[] = [];
  const cls = d.classes.find((c) => c.id === child.classId);
  const year = schoolYearFor(d, month);
  if (!cls) return { lines, warnings: ["Trẻ chưa được xếp lớp."] };
  if (!year) return { lines, warnings: [`Chưa có năm học cho tháng ${Number(month.slice(5))}/${month.slice(0, 4)}.`] };
  const warnings: string[] = [];
  const ageGroupId = d.ageGroups.find((a) => a.code === cls.ageGroup)?.id;
  const config = configFor(d, child.schoolId, month);
  const schoolDays = monthDays(month).filter(isSchoolDay);
  const attended = schoolDays.filter((day) => day >= child.enrolledOn);
  if (attended.length === 0) return { lines, warnings };

  for (const fee of d.feeTypes.filter((f) => f.active).sort((a, b) => a.orderNo - b.orderNo)) {
    if (fee.calcMethod === "OPTIONAL" && !d.feeItems.some((i) => i.childId === child.id && i.feeTypeId === fee.id && covers(i.fromMonth, i.toMonth, month))) continue;
    if (
      fee.calcMethod === "ONE_TIME" &&
      d.invoices.some(
        (i) =>
          i.childId === child.id &&
          i.status !== "CANCELLED" &&
          i.periodMonth !== `${month}-01` &&
          i.periodMonth >= year.startDate &&
          i.periodMonth <= year.endDate &&
          i.lines.some((l) => l.kind === "CHARGE" && l.feeTypeId === fee.id),
      )
    )
      continue;
    const price = priceFor(d, child.schoolId, year.id, fee.id, ageGroupId, month);
    if (price === undefined) {
      if (fee.calcMethod === "MONTHLY" || fee.calcMethod === "PER_DAY") warnings.push(`Chưa có biểu phí "${fee.name}" cho khối của trẻ.`);
      continue;
    }
    let quantity = 1;
    if (fee.calcMethod === "PER_DAY") quantity = attended.length;
    else if (fee.calcMethod === "MONTHLY" && config?.proration === "BY_SCHOOL_DAYS" && attended.length < schoolDays.length)
      quantity = Math.round((attended.length / schoolDays.length) * 100) / 100;
    lines.push({ feeTypeId: fee.id, kind: "CHARGE", description: fee.name, quantity, unitPrice: price, amount: Math.round(price * quantity) });
  }
  if (!lines.length) return { lines, warnings };

  // TODO(assumption): bản demo không lưu giờ báo vắng nên "báo trước giờ báo ăn" tính như mọi ngày vắng có phép
  const prevMonth = shiftMonthStr(month, -1);
  const prev = activeInvoice(d, child.id, prevMonth);
  if (prev && config?.mealRefundRule !== "NONE") {
    const excused = Object.entries(d.childAttendance).filter(([day, marks]) => day.startsWith(prevMonth) && marks[child.id] === "E").length;
    const refundable = prev.lines.filter(
      (l) => l.kind === "CHARGE" && d.feeTypes.some((f) => f.id === l.feeTypeId && f.refundableOnAbsence && f.calcMethod === "PER_DAY"),
    );
    for (const line of refundable) {
      const quantity = Math.min(excused, line.quantity);
      if (quantity > 0)
        lines.push({
          feeTypeId: line.feeTypeId,
          kind: "REFUND",
          description: `Hoàn ${line.description.toLowerCase()} ${quantity} ngày nghỉ có phép tháng ${Number(prevMonth.slice(5))}`,
          quantity,
          unitPrice: -line.unitPrice,
          amount: -quantity * line.unitPrice,
        });
    }
  }

  for (const discount of d.discounts.filter((x) => x.childId === child.id && covers(x.fromMonth, x.toMonth, month))) {
    const base = sum(lines.filter((l) => l.kind === "CHARGE" && (!discount.feeTypeId || l.feeTypeId === discount.feeTypeId)).map((l) => l.amount));
    const amount = Math.min(base, discount.percent ? Math.round((base * discount.percent) / 100) : (discount.amount ?? 0));
    if (amount > 0)
      lines.push({ feeTypeId: discount.feeTypeId, kind: "DISCOUNT", description: `Miễn giảm: ${discount.reason}`, quantity: 1, unitPrice: -amount, amount: -amount });
  }
  return { lines, warnings };
}

/** Sinh/tính lại phiếu nháp của tháng cho các trẻ của cơ sở; phiếu đã phát hành giữ nguyên. */
export function generate(d: DemoDB, schoolId: string, month: string, newId: () => string, childIds?: string[]): S["GenerateResult"] {
  const result: S["GenerateResult"] = { created: 0, updated: 0, skipped: 0, warnings: [] };
  const dueDate = `${month}-${String(Math.min(configFor(d, schoolId, month)?.dueDay ?? 10, 28)).padStart(2, "0")}`;
  for (const child of d.children.filter((c) => c.schoolId === schoolId && (!childIds?.length || childIds.includes(c.id)))) {
    const existing = activeInvoice(d, child.id, month);
    if (existing && existing.status !== "DRAFT") {
      result.skipped += 1;
      continue;
    }
    const { lines, warnings } = calculate(d, child, month);
    warnings.forEach((message) => result.warnings.push({ childId: child.id, childName: child.fullName, message }));
    if (!lines.some((l) => l.kind === "CHARGE")) {
      if (existing) d.invoices.splice(d.invoices.indexOf(existing), 1);
      result.skipped += 1;
      continue;
    }
    if (existing) {
      Object.assign(existing, { lines, dueDate, classId: child.classId });
      result.updated += 1;
    } else {
      d.invoices.push({ id: newId(), schoolId, childId: child.id, classId: child.classId, periodMonth: `${month}-01`, status: "DRAFT", dueDate, lines, payments: [] });
      result.created += 1;
    }
  }
  return result;
}

const noPrefix = (periodMonth: string) => `HP${periodMonth.slice(2, 4)}${periodMonth.slice(5, 7)}-`;

/** Phát hành: cấp số phiếu, chốt số dư các phiếu trước còn mở vào dòng "Nợ kỳ trước"/"Trả thừa kỳ trước". */
export function issue(d: DemoDB, invoices: InvoiceRec[], at: string) {
  const name = (inv: InvoiceRec) => d.children.find((c) => c.id === inv.childId)?.fullName ?? "";
  for (const inv of [...invoices].sort((a, b) => name(a).localeCompare(name(b), "vi"))) {
    const prefix = noPrefix(inv.periodMonth);
    const seq = d.invoices.filter((i) => i.schoolId === inv.schoolId && i.invoiceNo?.startsWith(prefix)).length + 1;
    const sources = d.invoices.filter((i) => i.childId === inv.childId && isOpen(i) && i.periodMonth < inv.periodMonth && balanceOf(i) !== 0);
    const carried = sum(sources.map(balanceOf));
    inv.lines = inv.lines.filter((l) => l.kind !== "CARRIED");
    if (carried !== 0)
      inv.lines.push({
        kind: "CARRIED",
        description: carried > 0 ? "Nợ kỳ trước" : "Trả thừa kỳ trước",
        quantity: 1,
        unitPrice: carried,
        amount: carried,
        note: sources.map((s) => s.invoiceNo ?? "").join(", "),
      });
    inv.invoiceNo = `${prefix}${String(seq).padStart(4, "0")}`;
    inv.status = "ISSUED";
    inv.issuedAt = at;
    refreshStatus(inv);
    for (const source of sources) {
      source.status = "CARRIED";
      source.carriedToId = inv.id;
    }
  }
}

/** Ghi một lần thu và bút toán "Thu học phí" tương ứng trong sổ thu chi. */
export function pay(d: DemoDB, inv: InvoiceRec, payment: S["PaymentDto"]) {
  inv.payments.push(payment);
  refreshStatus(inv);
  d.cashEntries.push({
    id: `pay-${payment.id}`,
    schoolId: inv.schoolId,
    categoryId: TUITION_CATEGORY_ID,
    categoryName: d.cashCategories.find((c) => c.id === TUITION_CATEGORY_ID)?.name ?? "Thu học phí",
    direction: "IN",
    source: "PAYMENT",
    amount: payment.amount,
    entryDate: payment.paidOn,
    description: `Thu học phí ${inv.invoiceNo} – ${d.children.find((c) => c.id === inv.childId)?.fullName ?? ""}`,
    invoiceId: inv.id,
    createdByName: payment.receivedByName,
  });
}
