import * as XLSX from "xlsx";
import type { components } from "@/api/schema";
import { db, type InvoiceRec } from "../db";
import { fileUrl } from "../files";
import { invoicePdf } from "../pdf";
import { amountPaid, balanceOf, generate, isOpen, issue, pay, refreshStatus, toRow } from "../finance";
import { type Ctx, FileBody, MockError, matches, newId, notFound, nowIso, on, paginate } from "../router";
import { today } from "./common";

type S = components["schemas"];

// ------------------------------------------------------------ quyền (khớp FinanceAccess của backend)

const grants = (ctx: Ctx) => db().users[ctx.user.role].grants.filter((g) => g.schoolId === ctx.schoolId);
const has = (ctx: Ctx, ...roles: string[]) => grants(ctx).some((g) => roles.includes(g.role));
const canManage = (ctx: Ctx) =>
  has(ctx, "ACCOUNTANT", "PRINCIPAL") || grants(ctx).some((g) => g.role === "VICE_PRINCIPAL" && !!g.functionGroups?.includes("FINANCE"));
const canCollect = canManage;

function requireView(ctx: Ctx) {
  if (!canManage(ctx)) throw new MockError(403, "Bạn không có quyền xem dữ liệu tài chính.");
}

function requireManage(ctx: Ctx) {
  if (!canManage(ctx)) throw new MockError(403, "Chỉ kế toán được thực hiện thao tác này.");
}

function requireCatalog(ctx: Ctx) {
  if (!db().users[ctx.user.role].grants.some((g) => g.role === "PRINCIPAL"))
    throw new MockError(403, "Chỉ hiệu trưởng được sửa danh mục dùng chung.");
}

/** Số tiền phụ huynh còn nợ (các phiếu đang mở). */
export function invoiceBalance(childId: string): number {
  return db()
    .invoices.filter((i) => i.childId === childId && isOpen(i))
    .reduce((s, i) => s + balanceOf(i), 0);
}

const monthParam = (value: string | null | undefined) => {
  if (!value || !/^\d{4}-\d{2}/.test(value)) throw new MockError(400, "Tháng không hợp lệ.");
  return value.slice(0, 7);
};

function requireAmount(value: unknown, label = "Số tiền"): number {
  const amount = Math.round(Number(value));
  if (!(amount > 0)) throw new MockError(400, `${label} phải lớn hơn 0.`);
  return amount;
}

function requireText(value: unknown, message: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new MockError(400, message);
  return text;
}

// ------------------------------------------------------------ năm học, khối, khoản thu, biểu phí, cấu hình

on("GET", "/school-years", () => [...db().schoolYears].sort((a, b) => b.startDate.localeCompare(a.startDate)));
on("GET", "/age-groups", () => db().ageGroups);

on("GET", "/fee-types", (ctx) => {
  requireView(ctx);
  return [...db().feeTypes].sort((a, b) => a.orderNo - b.orderNo);
});

on("POST", "/fee-types", (ctx) => {
  requireCatalog(ctx);
  const body = ctx.body as S["CreateFeeTypeRequest"];
  const code = requireText(body.code, "Vui lòng nhập mã khoản thu.").toUpperCase();
  if (db().feeTypes.some((f) => f.code === code)) throw new MockError(409, "Mã khoản thu đã tồn tại.");
  const fee: S["FeeTypeDto"] = {
    id: newId(),
    code,
    name: requireText(body.name, "Vui lòng nhập tên khoản thu."),
    calcMethod: body.calcMethod,
    refundableOnAbsence: !!body.refundableOnAbsence && body.calcMethod === "PER_DAY",
    orderNo: body.orderNo ?? db().feeTypes.length + 1,
    active: true,
  };
  db().feeTypes.push(fee);
  return fee;
});

on("PUT", "/fee-types/{id}", (ctx) => {
  requireCatalog(ctx);
  const fee = db().feeTypes.find((f) => f.id === ctx.params.id) ?? notFound("khoản thu");
  const body = ctx.body as S["UpdateFeeTypeRequest"];
  Object.assign(fee, {
    name: requireText(body.name, "Vui lòng nhập tên khoản thu."),
    active: body.active,
    orderNo: body.orderNo ?? fee.orderNo,
    refundableOnAbsence: !!body.refundableOnAbsence && fee.calcMethod === "PER_DAY",
  });
  return fee;
});

on("GET", "/fee-schedules", (ctx) => {
  requireView(ctx);
  const yearId = ctx.query.get("schoolYearId");
  const order = (s: S["FeeScheduleDto"]) => db().feeTypes.find((f) => f.id === s.feeTypeId)?.orderNo ?? 0;
  return db()
    .feeSchedules.filter((s) => s.schoolId === ctx.schoolId && (!yearId || s.schoolYearId === yearId))
    .sort((a, b) => order(a) - order(b) || (a.ageGroupName ?? "").localeCompare(b.ageGroupName ?? "") || b.effectiveFrom.localeCompare(a.effectiveFrom));
});

on("POST", "/fee-schedules", (ctx) => {
  requireManage(ctx);
  const body = ctx.body as S["FeeScheduleRequest"];
  const fee = db().feeTypes.find((f) => f.id === body.feeTypeId) ?? notFound("khoản thu");
  const year = db().schoolYears.find((y) => y.id === body.schoolYearId) ?? notFound("năm học");
  const ageGroup = body.ageGroupId ? (db().ageGroups.find((a) => a.id === body.ageGroupId) ?? notFound("khối")) : undefined;
  if (body.effectiveFrom < year.startDate || body.effectiveFrom > year.endDate) throw new MockError(400, "Ngày hiệu lực phải nằm trong năm học.");
  const duplicate = db().feeSchedules.some(
    (s) => s.schoolId === ctx.schoolId && s.schoolYearId === year.id && s.feeTypeId === fee.id && s.ageGroupId === ageGroup?.id && s.effectiveFrom === body.effectiveFrom,
  );
  if (duplicate) throw new MockError(409, "Đã có mức thu này với cùng ngày hiệu lực.");
  const schedule: S["FeeScheduleDto"] = {
    id: newId(),
    schoolId: ctx.schoolId,
    schoolYearId: year.id,
    feeTypeId: fee.id,
    feeTypeName: fee.name,
    calcMethod: fee.calcMethod,
    ageGroupId: ageGroup?.id,
    ageGroupName: ageGroup?.name,
    amount: Math.round(Number(body.amount)),
    effectiveFrom: body.effectiveFrom,
    note: body.note || undefined,
  };
  if (!(schedule.amount >= 0)) throw new MockError(400, "Mức thu không hợp lệ.");
  db().feeSchedules.push(schedule);
  return schedule;
});

on("DELETE", "/fee-schedules/{id}", (ctx) => {
  requireManage(ctx);
  const list = db().feeSchedules;
  const index = list.findIndex((s) => s.id === ctx.params.id && s.schoolId === ctx.schoolId);
  if (index < 0) notFound("mức thu");
  list.splice(index, 1);
});

on("GET", "/finance/configs", (ctx) => {
  requireView(ctx);
  return db()
    .financeConfigs.filter((c) => !c.schoolId || c.schoolId === ctx.schoolId)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
});

on("POST", "/finance/configs", (ctx) => {
  const body = ctx.body as S["FinanceConfigRequest"];
  if (body.organizationWide) requireCatalog(ctx);
  else requireManage(ctx);
  const schoolId = body.organizationWide ? undefined : ctx.schoolId;
  if (db().financeConfigs.some((c) => c.schoolId === schoolId && c.effectiveFrom === body.effectiveFrom)) throw new MockError(409, "Đã có cấu hình với ngày hiệu lực này.");
  const dueDay = body.dueDay ?? 10;
  if (dueDay < 1 || dueDay > 28) throw new MockError(400, "Hạn nộp phải từ ngày 1 đến ngày 28.");
  const config: S["FinanceConfigDto"] = { id: newId(), schoolId, effectiveFrom: body.effectiveFrom, dueDay, mealRefundRule: body.mealRefundRule, proration: body.proration };
  db().financeConfigs.push(config);
  return config;
});

// ------------------------------------------------------------ khoản tự chọn, miễn giảm, phiếu của trẻ

function requireChild(ctx: Ctx) {
  const child = db().children.find((c) => c.id === ctx.params.childId && c.schoolId === ctx.schoolId);
  if (!child) notFound("trẻ");
  return child;
}

function checkMonths(from: string, to?: string) {
  if (!from) throw new MockError(400, "Vui lòng chọn tháng bắt đầu.");
  if (to && to.slice(0, 7) < from.slice(0, 7)) throw new MockError(400, "Tháng kết thúc phải sau tháng bắt đầu.");
}

on("GET", "/children/{childId}/fee-items", (ctx) => {
  requireView(ctx);
  const child = requireChild(ctx);
  return db().feeItems.filter((i) => i.childId === child.id);
});

function saveFeeItem(ctx: Ctx, id: string) {
  requireManage(ctx);
  const child = requireChild(ctx);
  const body = ctx.body as S["ChildFeeItemRequest"];
  const fee = db().feeTypes.find((f) => f.id === body.feeTypeId && f.calcMethod === "OPTIONAL");
  if (!fee) throw new MockError(400, "Chỉ đăng ký được khoản thu tự chọn.");
  checkMonths(body.fromMonth, body.toMonth);
  const item = { id, childId: child.id, feeTypeId: fee.id, feeTypeName: fee.name, fromMonth: `${body.fromMonth.slice(0, 7)}-01`, toMonth: body.toMonth ? `${body.toMonth.slice(0, 7)}-01` : undefined, note: body.note || undefined };
  const list = db().feeItems;
  const index = list.findIndex((i) => i.id === id && i.childId === child.id);
  if (index >= 0) list[index] = item;
  else list.push(item);
  return item;
}

on("POST", "/children/{childId}/fee-items", (ctx) => saveFeeItem(ctx, newId()));
on("PUT", "/children/{childId}/fee-items/{itemId}", (ctx) => {
  if (!db().feeItems.some((i) => i.id === ctx.params.itemId && i.childId === ctx.params.childId)) notFound("khoản đăng ký");
  return saveFeeItem(ctx, ctx.params.itemId);
});
on("DELETE", "/children/{childId}/fee-items/{itemId}", (ctx) => {
  requireManage(ctx);
  requireChild(ctx);
  const list = db().feeItems;
  const index = list.findIndex((i) => i.id === ctx.params.itemId && i.childId === ctx.params.childId);
  if (index < 0) notFound("khoản đăng ký");
  list.splice(index, 1);
});

on("GET", "/children/{childId}/discounts", (ctx) => {
  requireView(ctx);
  const child = requireChild(ctx);
  return db().discounts.filter((x) => x.childId === child.id);
});

function saveDiscount(ctx: Ctx, id: string) {
  requireManage(ctx);
  const child = requireChild(ctx);
  const body = ctx.body as S["ChildDiscountRequest"];
  if (!body.percent === !body.amount) throw new MockError(400, "Nhập phần trăm hoặc số tiền miễn giảm (một trong hai).");
  if (body.percent !== undefined && (body.percent <= 0 || body.percent > 100)) throw new MockError(400, "Phần trăm phải từ 1 đến 100.");
  checkMonths(body.fromMonth, body.toMonth);
  const fee = body.feeTypeId ? (db().feeTypes.find((f) => f.id === body.feeTypeId) ?? notFound("khoản thu")) : undefined;
  const discount = {
    id,
    childId: child.id,
    feeTypeId: fee?.id,
    feeTypeName: fee?.name,
    percent: body.percent || undefined,
    amount: body.amount ? Math.round(body.amount) : undefined,
    reason: requireText(body.reason, "Vui lòng nhập lý do miễn giảm."),
    fromMonth: `${body.fromMonth.slice(0, 7)}-01`,
    toMonth: body.toMonth ? `${body.toMonth.slice(0, 7)}-01` : undefined,
  };
  const list = db().discounts;
  const index = list.findIndex((x) => x.id === id && x.childId === child.id);
  if (index >= 0) list[index] = discount;
  else list.push(discount);
  return discount;
}

on("POST", "/children/{childId}/discounts", (ctx) => saveDiscount(ctx, newId()));
on("PUT", "/children/{childId}/discounts/{discountId}", (ctx) => {
  if (!db().discounts.some((x) => x.id === ctx.params.discountId && x.childId === ctx.params.childId)) notFound("miễn giảm");
  return saveDiscount(ctx, ctx.params.discountId);
});
on("DELETE", "/children/{childId}/discounts/{discountId}", (ctx) => {
  requireManage(ctx);
  requireChild(ctx);
  const list = db().discounts;
  const index = list.findIndex((x) => x.id === ctx.params.discountId && x.childId === ctx.params.childId);
  if (index < 0) notFound("miễn giảm");
  list.splice(index, 1);
});

on("GET", "/children/{childId}/invoices", (ctx) => {
  requireView(ctx);
  const child = requireChild(ctx);
  return db()
    .invoices.filter((i) => i.childId === child.id)
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))
    .map((i) => toRow(db(), i, today()));
});

// ------------------------------------------------------------ phiếu thu

const schoolInvoices = (ctx: Ctx) => db().invoices.filter((i) => i.schoolId === ctx.schoolId);

function requireInvoice(ctx: Ctx): InvoiceRec {
  return schoolInvoices(ctx).find((i) => i.id === ctx.params.id) ?? notFound("phiếu thu");
}

function invoiceRows(ctx: Ctx) {
  const month = monthParam(ctx.query.get("month"));
  const status = ctx.query.get("status");
  const classId = ctx.query.get("classId");
  const q = ctx.query.get("q");
  const overdue = ctx.query.get("overdue") === "true";
  return schoolInvoices(ctx)
    .filter((i) => i.periodMonth.startsWith(month) && (status ? i.status === status : i.status !== "CANCELLED") && (!classId || i.classId === classId))
    .map((i) => toRow(db(), i, today()))
    .filter((r) => matches(q, r.childName, r.childCode, r.invoiceNo) && (!overdue || r.overdue))
    .sort((a, b) => (a.className ?? "").localeCompare(b.className ?? "", "vi") || a.childName.localeCompare(b.childName, "vi"));
}

function detail(ctx: Ctx, inv: InvoiceRec): S["InvoiceDetail"] {
  return {
    invoice: toRow(db(), inv, today()),
    lines: inv.lines,
    payments: [...inv.payments].sort((a, b) => a.paidOn.localeCompare(b.paidOn)),
    issuedAt: inv.issuedAt,
    cancelReason: inv.cancelReason,
    carriedToId: inv.carriedToId,
    carriedToNo: db().invoices.find((i) => i.id === inv.carriedToId)?.invoiceNo,
    canManage: canManage(ctx),
    canCollect: canCollect(ctx),
  };
}

on("GET", "/invoices", (ctx) => {
  requireView(ctx);
  return paginate(invoiceRows(ctx), ctx.query, {
    childName: (r) => r.childName,
    className: (r) => r.className ?? "",
    amountDue: (r) => r.amountDue,
    balance: (r) => r.balance,
    invoiceNo: (r) => r.invoiceNo ?? "",
  });
});

on("GET", "/invoices/summary", (ctx): S["InvoiceSummary"] => {
  requireView(ctx);
  const month = monthParam(ctx.query.get("month"));
  const list = schoolInvoices(ctx).filter((i) => i.periodMonth.startsWith(month) && i.status !== "CANCELLED");
  const issued = list.filter((i) => i.status !== "DRAFT");
  const count = (status: InvoiceRec["status"]) => list.filter((i) => i.status === status).length;
  const total = (items: InvoiceRec[], f: (i: InvoiceRec) => number) => items.reduce((s, i) => s + f(i), 0);
  return {
    total: list.length,
    draft: count("DRAFT"),
    issued: count("ISSUED"),
    partial: count("PARTIAL"),
    paid: count("PAID"),
    carried: count("CARRIED"),
    amountDue: total(issued, (i) => toRow(db(), i, today()).amountDue),
    amountPaid: total(issued, amountPaid),
    balance: total(issued.filter(isOpen), balanceOf),
  };
});

on("GET", "/invoices/export", (ctx) => {
  requireView(ctx);
  const month = monthParam(ctx.query.get("month"));
  const header = ["Số phiếu", "Mã trẻ", "Họ tên", "Lớp", "Phát sinh", "Miễn giảm", "Hoàn", "Kỳ trước", "Phải thu", "Đã thu", "Còn lại", "Trạng thái", "Hạn nộp"];
  const rows = invoiceRows(ctx).map((r) => [r.invoiceNo ?? "", r.childCode ?? "", r.childName, r.className ?? "", r.subtotal, r.discount, r.refund, r.carriedBalance, r.amountDue, r.amountPaid, r.balance, r.status, r.dueDate ?? ""]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[`Phiếu thu tháng ${month}`], header, ...rows]), "Phiếu thu");
  return new FileBody(XLSX.write(book, { type: "array", bookType: "xlsx" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

on("POST", "/invoices/generate", (ctx) => {
  requireManage(ctx);
  const body = ctx.body as S["GenerateRequest"];
  return generate(db(), ctx.schoolId, monthParam(body?.month), newId, body?.childIds);
});

on("POST", "/invoices/issue", (ctx): S["IssueResult"] => {
  requireManage(ctx);
  const body = ctx.body as S["IssueRequest"];
  const month = monthParam(body?.month);
  const drafts = schoolInvoices(ctx).filter((i) => i.periodMonth.startsWith(month) && i.status === "DRAFT" && (!body.ids?.length || body.ids.includes(i.id)));
  issue(db(), drafts, nowIso());
  return { issued: drafts.length };
});

on("GET", "/invoices/{id}", (ctx) => {
  requireView(ctx);
  return detail(ctx, requireInvoice(ctx));
});

on("GET", "/invoices/{id}/pdf", (ctx) => {
  requireView(ctx);
  if (typeof document === "undefined") throw new MockError(501, "Cần trình duyệt để tạo PDF.");
  const inv = requireInvoice(ctx);
  const school = db().schools.find((s) => s.id === inv.schoolId)?.name ?? "";
  return new FileBody(invoicePdf(detail(ctx, inv), school), "application/pdf");
});

on("POST", "/invoices/{id}/issue", (ctx) => {
  requireManage(ctx);
  const inv = requireInvoice(ctx);
  if (inv.status !== "DRAFT") throw new MockError(409, "Phiếu đã được phát hành.");
  issue(db(), [inv], nowIso());
  return detail(ctx, inv);
});

on("POST", "/invoices/{id}/cancel", (ctx) => {
  requireManage(ctx);
  const inv = requireInvoice(ctx);
  if (inv.status === "DRAFT") {
    db().invoices.splice(db().invoices.indexOf(inv), 1);
    return;
  }
  if (inv.status === "CANCELLED") throw new MockError(409, "Phiếu đã bị hủy.");
  if (inv.status === "CARRIED") throw new MockError(409, "Số dư phiếu này đã chuyển sang phiếu tháng sau; hãy hủy phiếu tháng sau trước.");
  const reason = requireText(ctx.body?.reason, "Vui lòng nhập lý do hủy phiếu.");
  if (inv.payments.some((p) => !p.voidedAt)) throw new MockError(409, "Phiếu đã có thanh toán; hãy hủy các lần thu trước.");
  for (const source of db().invoices.filter((i) => i.carriedToId === inv.id)) {
    source.carriedToId = undefined;
    source.status = "ISSUED";
    refreshStatus(source);
  }
  inv.status = "CANCELLED";
  inv.cancelReason = reason;
});

on("POST", "/invoices/{id}/payments", (ctx) => {
  if (!canCollect(ctx)) throw new MockError(403, "Bạn không có quyền ghi nhận thanh toán.");
  const inv = requireInvoice(ctx);
  if (!isOpen(inv)) throw new MockError(409, "Chỉ ghi nhận thanh toán cho phiếu đã phát hành và chưa chuyển nợ sang tháng sau.");
  const body = ctx.body as S["PaymentRequest"];
  const paidOn = body.paidOn || today();
  if (paidOn > today()) throw new MockError(400, "Ngày thu không được sau hôm nay.");
  pay(db(), inv, {
    id: newId(),
    amount: requireAmount(body.amount),
    method: body.method === "CASH" ? "CASH" : "TRANSFER",
    paidOn,
    reference: body.reference || undefined,
    note: body.note || undefined,
    receivedByName: ctx.user.staff.fullName,
  });
  return detail(ctx, inv);
});

on("POST", "/invoices/{id}/payments/{paymentId}/void", (ctx) => {
  requireManage(ctx);
  const inv = requireInvoice(ctx);
  const payment = inv.payments.find((p) => p.id === ctx.params.paymentId) ?? notFound("lần thu");
  if (payment.voidedAt) throw new MockError(409, "Lần thu này đã bị hủy.");
  if (!isOpen(inv)) throw new MockError(409, "Số dư phiếu đã chuyển sang phiếu tháng sau, không hủy được lần thu.");
  payment.voidedAt = nowIso();
  payment.voidReason = requireText(ctx.body?.reason, "Vui lòng nhập lý do hủy lần thu.");
  refreshStatus(inv);
  const entries = db().cashEntries;
  const index = entries.findIndex((e) => e.id === `pay-${payment.id}`);
  if (index >= 0) entries.splice(index, 1);
  return detail(ctx, inv);
});

// ------------------------------------------------------------ công nợ

function receivableRows(ctx: Ctx): S["ReceivableRow"][] {
  const classId = ctx.query.get("classId");
  const q = ctx.query.get("q");
  const overdueOnly = ctx.query.get("overdue") === "true";
  const now = today();
  const byChild = new Map<string, S["InvoiceRow"][]>();
  for (const inv of schoolInvoices(ctx).filter((i) => isOpen(i) && balanceOf(i) > 0)) {
    byChild.set(inv.childId, [...(byChild.get(inv.childId) ?? []), toRow(db(), inv, now)]);
  }
  const latestOf = (list: S["InvoiceRow"][]) => list.reduce((a, b) => (b.periodMonth > a.periodMonth ? b : a));
  return [...byChild.entries()]
    .filter(([, list]) => !classId || latestOf(list).classId === classId)
    .map(([childId, list]): S["ReceivableRow"] => {
      const latest = latestOf(list);
      const oldestDue = list.map((r) => r.dueDate).filter((d): d is string => !!d).sort()[0];
      const overdueDays = oldestDue && now > oldestDue ? Math.round((Date.parse(now) - Date.parse(oldestDue)) / 86_400_000) : 0;
      return {
        childId,
        childName: latest.childName,
        childCode: latest.childCode,
        schoolId: latest.schoolId,
        className: latest.className,
        invoiceCount: list.length,
        balance: list.reduce((s, r) => s + r.balance, 0),
        oldestDueDate: oldestDue,
        overdueDays,
        latestInvoiceId: latest.id,
      };
    })
    .filter((r) => matches(q, r.childName, r.childCode) && (!overdueOnly || r.overdueDays > 0))
    .sort((a, b) => b.balance - a.balance || a.childName.localeCompare(b.childName, "vi"));
}

on("GET", "/receivables", (ctx) => {
  requireView(ctx);
  return paginate(receivableRows(ctx), ctx.query, { balance: (r) => r.balance, childName: (r) => r.childName, overdueDays: (r) => r.overdueDays });
});

on("GET", "/receivables/summary", (ctx): S["ReceivableSummary"] => {
  requireView(ctx);
  const rows = receivableRows({ ...ctx, query: new URLSearchParams() });
  const late = rows.filter((r) => r.overdueDays > 0);
  return {
    children: rows.length,
    balance: rows.reduce((s, r) => s + r.balance, 0),
    overdueChildren: late.length,
    overdueBalance: late.reduce((s, r) => s + r.balance, 0),
  };
});

// ------------------------------------------------------------ sổ thu chi

on("GET", "/cash-categories", (ctx) => {
  requireView(ctx);
  return [...db().cashCategories].sort((a, b) => a.direction.localeCompare(b.direction) || a.orderNo - b.orderNo);
});

on("POST", "/cash-categories", (ctx) => {
  requireCatalog(ctx);
  const body = ctx.body as S["CreateCashCategoryRequest"];
  const name = requireText(body.name, "Vui lòng nhập tên danh mục.");
  if (db().cashCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new MockError(409, "Danh mục đã tồn tại.");
  const category: S["CashCategoryDto"] = { id: newId(), name, direction: body.direction, orderNo: body.orderNo ?? db().cashCategories.length + 1, active: true, system: false };
  db().cashCategories.push(category);
  return category;
});

on("PUT", "/cash-categories/{id}", (ctx) => {
  requireCatalog(ctx);
  const category = db().cashCategories.find((c) => c.id === ctx.params.id) ?? notFound("danh mục");
  if (category.system) throw new MockError(409, "Không sửa được danh mục hệ thống.");
  const body = ctx.body as S["UpdateCashCategoryRequest"];
  Object.assign(category, { name: requireText(body.name, "Vui lòng nhập tên danh mục."), active: body.active, orderNo: body.orderNo ?? category.orderNo });
  return category;
});

function cashRows(ctx: Ctx) {
  const from = ctx.query.get("from");
  const to = ctx.query.get("to");
  return db().cashEntries.filter((e) => e.schoolId === ctx.schoolId && (!from || e.entryDate >= from) && (!to || e.entryDate <= to));
}

on("GET", "/cash-entries", (ctx) => {
  requireView(ctx);
  const direction = ctx.query.get("direction");
  const categoryId = ctx.query.get("categoryId");
  const q = ctx.query.get("q");
  const list = cashRows(ctx)
    .filter((e) => (!direction || e.direction === direction) && (!categoryId || e.categoryId === categoryId) && matches(q, e.description, e.categoryName))
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  return paginate(list, ctx.query, { entryDate: (e) => e.entryDate, amount: (e) => e.amount });
});

on("GET", "/cash-entries/summary", (ctx): S["CashSummary"] => {
  requireView(ctx);
  const list = cashRows(ctx);
  const byCategory = new Map<string, S["CategoryTotal"]>();
  for (const e of list) {
    const row = byCategory.get(e.categoryId) ?? { categoryId: e.categoryId, categoryName: e.categoryName, direction: e.direction, amount: 0 };
    row.amount += e.amount;
    byCategory.set(e.categoryId, row);
  }
  const totalIn = list.filter((e) => e.direction === "IN").reduce((s, e) => s + e.amount, 0);
  const totalOut = list.filter((e) => e.direction === "OUT").reduce((s, e) => s + e.amount, 0);
  return { totalIn, totalOut, net: totalIn - totalOut, byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount) };
});

function saveEntry(ctx: Ctx, id: string) {
  requireManage(ctx);
  const body = ctx.body as S["CashEntryRequest"];
  const category = db().cashCategories.find((c) => c.id === body.categoryId);
  if (!category || category.system || !category.active) throw new MockError(400, "Danh mục không hợp lệ cho khoản nhập tay.");
  const entry: S["CashEntryDto"] = {
    id,
    schoolId: ctx.schoolId,
    categoryId: category.id,
    categoryName: category.name,
    direction: category.direction,
    source: "MANUAL",
    amount: requireAmount(body.amount),
    entryDate: body.entryDate || today(),
    description: requireText(body.description, "Vui lòng nhập nội dung."),
    fileId: body.fileId,
    createdByName: ctx.user.staff.fullName,
  };
  const list = db().cashEntries;
  const index = list.findIndex((e) => e.id === id);
  if (index >= 0) list[index] = entry;
  else list.push(entry);
  return entry;
}

function requireManualEntry(ctx: Ctx) {
  const entry = db().cashEntries.find((e) => e.id === ctx.params.id && e.schoolId === ctx.schoolId) ?? notFound("khoản thu chi");
  if (entry.source !== "MANUAL") throw new MockError(409, "Khoản do hệ thống ghi, không sửa hoặc xóa được.");
  return entry;
}

on("POST", "/cash-entries", (ctx) => saveEntry(ctx, newId()));
on("PUT", "/cash-entries/{id}", (ctx) => {
  requireManage(ctx);
  return saveEntry(ctx, requireManualEntry(ctx).id);
});
on("DELETE", "/cash-entries/{id}", (ctx) => {
  requireManage(ctx);
  const entry = requireManualEntry(ctx);
  db().cashEntries.splice(db().cashEntries.indexOf(entry), 1);
});
on("GET", "/cash-entries/{id}/file-url", (ctx) => {
  requireView(ctx);
  const entry = db().cashEntries.find((e) => e.id === ctx.params.id && e.schoolId === ctx.schoolId);
  if (!entry?.fileId) notFound("chứng từ");
  return { url: fileUrl(entry.fileId), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
});
