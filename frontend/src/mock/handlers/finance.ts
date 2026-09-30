import type { DebtItem, FeeSummary, InvoiceDetail, InvoiceItem, InvoiceStatus } from "@/api/contracts";
import { db, type InvoiceRec } from "../db";
import { type Ctx, MockError, matches, newId, notFound, on, paginate, requireBgh } from "../router";
import { today } from "./common";

const total = (inv: InvoiceRec) => inv.lines.reduce((s, l) => s + l.amount, 0);
const paid = (inv: InvoiceRec) => inv.payments.reduce((s, p) => s + p.amount, 0);

/** Số tiền phụ huynh còn nợ (mọi phiếu thu). */
export function invoiceBalance(childId: string): number {
  return db()
    .invoices.filter((i) => i.childId === childId)
    .reduce((s, i) => s + total(i) - paid(i), 0);
}

function status(inv: InvoiceRec): InvoiceStatus {
  const p = paid(inv);
  return p >= total(inv) ? "PAID" : p > 0 ? "PARTIAL" : "UNPAID";
}

function toItem(inv: InvoiceRec): InvoiceItem {
  const child = db().children.find((c) => c.id === inv.childId)!;
  const t = total(inv);
  const p = paid(inv);
  return {
    id: inv.id,
    code: inv.code,
    childId: inv.childId,
    childName: child.fullName,
    className: db().classes.find((c) => c.id === child.classId)?.name ?? "",
    month: inv.month,
    total: t,
    paid: p,
    balance: t - p,
    status: status(inv),
    dueDate: inv.dueDate,
    overdue: t > p && inv.dueDate < today(),
  };
}

function toDetail(inv: InvoiceRec): InvoiceDetail {
  const child = db().children.find((c) => c.id === inv.childId)!;
  return { ...toItem(inv), guardianName: child.guardianName, guardianPhone: child.guardianPhone, lines: inv.lines, payments: inv.payments };
}

const schoolInvoices = (ctx: Ctx) => db().invoices.filter((i) => i.schoolId === ctx.schoolId);

function requireInvoice(ctx: Ctx): InvoiceRec {
  const inv = schoolInvoices(ctx).find((i) => i.id === ctx.params.id);
  if (!inv) notFound("phiếu thu");
  return inv;
}

on("GET", "/invoices", (ctx) => {
  requireBgh(ctx);
  const month = ctx.query.get("month");
  const st = ctx.query.get("status");
  const classId = ctx.query.get("classId");
  const q = ctx.query.get("q");
  const list = schoolInvoices(ctx)
    .filter((i) => !month || i.month === month)
    .map(toItem)
    .filter((i) => (!st || i.status === st) && matches(q, i.childName, i.code))
    .filter((i) => !classId || db().children.find((c) => c.id === i.childId)?.classId === classId);
  return paginate(list, ctx.query, { childName: (i) => i.childName.split(" ").pop() + i.childName, balance: (i) => i.balance, total: (i) => i.total, className: (i) => i.className });
});

on("GET", "/invoices/summary", (ctx) => {
  requireBgh(ctx);
  const month = ctx.query.get("month") ?? today().slice(0, 7);
  const items = schoolInvoices(ctx).filter((i) => i.month === month).map(toItem);
  const summary: FeeSummary = {
    month,
    total: items.reduce((s, i) => s + i.total, 0),
    collected: items.reduce((s, i) => s + i.paid, 0),
    outstanding: items.reduce((s, i) => s + i.balance, 0),
    counts: { PAID: 0, PARTIAL: 0, UNPAID: 0 },
  };
  for (const i of items) summary.counts[i.status] += 1;
  return summary;
});

on("GET", "/invoices/{id}", (ctx) => {
  requireBgh(ctx);
  return toDetail(requireInvoice(ctx));
});

on("POST", "/invoices/{id}/payments", (ctx) => {
  requireBgh(ctx);
  const inv = requireInvoice(ctx);
  const amount = Math.round(Number(ctx.body?.amount));
  const balance = total(inv) - paid(inv);
  if (!(amount > 0)) throw new MockError(400, "Số tiền phải lớn hơn 0.");
  if (amount > balance) throw new MockError(400, `Số tiền vượt quá số còn phải thu (${balance.toLocaleString("vi-VN")} ₫).`);
  inv.payments.push({ id: newId(), date: ctx.body?.date ?? today(), amount, method: ctx.body?.method === "CASH" ? "CASH" : "TRANSFER" });
  return toDetail(inv);
});

on("GET", "/debts", (ctx) => {
  requireBgh(ctx);
  const byChild = new Map<string, DebtItem>();
  for (const inv of schoolInvoices(ctx).map(toItem).filter((i) => i.balance > 0 && i.overdue)) {
    const child = db().children.find((c) => c.id === inv.childId)!;
    const row = byChild.get(inv.childId) ?? {
      childId: inv.childId,
      childName: inv.childName,
      className: inv.className,
      guardianName: child.guardianName,
      guardianPhone: child.guardianPhone,
      months: [],
      balance: 0,
    };
    row.months.push(inv.month);
    row.balance += inv.balance;
    byChild.set(inv.childId, row);
  }
  return [...byChild.values()].sort((a, b) => b.balance - a.balance);
});
