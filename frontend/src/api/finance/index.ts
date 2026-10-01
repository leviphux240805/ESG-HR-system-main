import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";

type S = components["schemas"];
export type FeeType = S["FeeTypeDto"];
export type FeeSchedule = S["FeeScheduleDto"];
export type ChildFeeItem = S["ChildFeeItemDto"];
export type ChildDiscount = S["ChildDiscountDto"];
export type FinanceConfig = S["FinanceConfigDto"];
export type InvoiceRow = S["InvoiceRow"];
export type InvoiceDetail = S["InvoiceDetail"];
export type InvoiceLine = S["InvoiceLineDto"];
export type Payment = S["PaymentDto"];
export type InvoiceSummary = S["InvoiceSummary"];
export type GenerateResult = S["GenerateResult"];
export type ReceivableRow = S["ReceivableRow"];
export type ReceivableSummary = S["ReceivableSummary"];
export type CashCategory = S["CashCategoryDto"];
export type CashEntry = S["CashEntryDto"];
export type CashSummary = S["CashSummary"];
export type SchoolYear = S["SchoolYearDto"];
export type AgeGroupDto = S["AgeGroupDto"];
export type InvoiceStatus = InvoiceRow["status"];
export type CalcMethod = FeeType["calcMethod"];

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  DRAFT: { label: "Nháp", tone: "neutral" },
  ISSUED: { label: "Chưa thu", tone: "danger" },
  PARTIAL: { label: "Thu một phần", tone: "warning" },
  PAID: { label: "Đã thu đủ", tone: "success" },
  CARRIED: { label: "Đã chuyển nợ", tone: "info" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};

export const CALC_METHOD_LABELS: Record<CalcMethod, string> = {
  MONTHLY: "Theo tháng",
  PER_DAY: "Theo ngày học",
  ONE_TIME: "Một lần mỗi năm học",
  OPTIONAL: "Tự chọn",
};

export const MEAL_REFUND_LABELS: Record<FinanceConfig["mealRefundRule"], string> = {
  BEFORE_CUTOFF: "Hoàn ngày vắng báo trước giờ báo ăn",
  ALL_EXCUSED: "Hoàn mọi ngày vắng có phép",
  NONE: "Không hoàn",
};

export const PRORATION_LABELS: Record<FinanceConfig["proration"], string> = {
  FULL_MONTH: "Thu đủ tháng",
  BY_SCHOOL_DAYS: "Chia theo ngày học",
};

export const PAYMENT_METHOD_LABELS: Record<Payment["method"], string> = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản" };

export const CASH_SOURCE_LABELS: Record<CashEntry["source"], string> = { MANUAL: "Nhập tay", PAYMENT: "Thu học phí", PAYROLL: "Lương" };

export const INVOICE_FILTER_KEYS = ["status", "classId", "overdue"] as const;
export const RECEIVABLE_FILTER_KEYS = ["classId", "overdue"] as const;
export const CASH_FILTER_KEYS = ["direction", "categoryId"] as const;

/** "2026-09" → "2026-09-01" (tham số tháng của API là ngày đầu tháng). */
export const monthStart = (month: string) => `${month.slice(0, 7)}-01`;

/** Ngày cuối tháng của "2026-09" → "2026-09-30". */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

const listQuery = (params: ListParams) => params.apiParams as Record<string, string | number | undefined>;

// ------------------------------------------------------------ danh mục, năm học, khối

export function useSchoolYears() {
  return useQuery({ queryKey: ["school-years"], queryFn: async () => unwrap(await api.GET("/api/v1/school-years")), staleTime: 5 * 60_000 });
}

export function useAgeGroups() {
  return useQuery({ queryKey: ["age-groups"], queryFn: async () => unwrap(await api.GET("/api/v1/age-groups")), staleTime: 5 * 60_000 });
}

export function useFeeTypes() {
  return useQuery({ queryKey: ["finance", "fee-types"], queryFn: async () => unwrap(await api.GET("/api/v1/fee-types")) });
}

export async function createFeeType(body: S["CreateFeeTypeRequest"]) {
  return unwrap(await api.POST("/api/v1/fee-types", { body }));
}

export async function updateFeeType(id: string, body: S["UpdateFeeTypeRequest"]) {
  return unwrap(await api.PUT("/api/v1/fee-types/{id}", { params: { path: { id } }, body }));
}

export function useFeeSchedules(schoolYearId: string | undefined) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "fee-schedules", schoolYearId),
    queryFn: async () => unwrap(await api.GET("/api/v1/fee-schedules", { params: { query: { schoolYearId } } })),
    enabled: !!schoolYearId,
  });
}

export async function createFeeSchedule(body: S["FeeScheduleRequest"]) {
  return unwrap(await api.POST("/api/v1/fee-schedules", { body }));
}

export async function deleteFeeSchedule(id: string) {
  return unwrap(await api.DELETE("/api/v1/fee-schedules/{id}", { params: { path: { id } } }));
}

export function useFinanceConfigs() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("finance", "configs"), queryFn: async () => unwrap(await api.GET("/api/v1/finance/configs")) });
}

export async function createFinanceConfig(body: S["FinanceConfigRequest"]) {
  return unwrap(await api.POST("/api/v1/finance/configs", { body }));
}

// ------------------------------------------------------------ khoản tự chọn, miễn giảm theo trẻ

export function useChildFeeItems(childId: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "child", childId, "fee-items"),
    queryFn: async () => unwrap(await api.GET("/api/v1/children/{childId}/fee-items", { params: { path: { childId } } })),
  });
}

export async function saveChildFeeItem(childId: string, itemId: string | null, body: S["ChildFeeItemRequest"]) {
  return itemId
    ? unwrap(await api.PUT("/api/v1/children/{childId}/fee-items/{itemId}", { params: { path: { childId, itemId } }, body }))
    : unwrap(await api.POST("/api/v1/children/{childId}/fee-items", { params: { path: { childId } }, body }));
}

export async function deleteChildFeeItem(childId: string, itemId: string) {
  return unwrap(await api.DELETE("/api/v1/children/{childId}/fee-items/{itemId}", { params: { path: { childId, itemId } } }));
}

export function useChildDiscounts(childId: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "child", childId, "discounts"),
    queryFn: async () => unwrap(await api.GET("/api/v1/children/{childId}/discounts", { params: { path: { childId } } })),
  });
}

export async function saveChildDiscount(childId: string, discountId: string | null, body: S["ChildDiscountRequest"]) {
  return discountId
    ? unwrap(await api.PUT("/api/v1/children/{childId}/discounts/{discountId}", { params: { path: { childId, discountId } }, body }))
    : unwrap(await api.POST("/api/v1/children/{childId}/discounts", { params: { path: { childId } }, body }));
}

export async function deleteChildDiscount(childId: string, discountId: string) {
  return unwrap(await api.DELETE("/api/v1/children/{childId}/discounts/{discountId}", { params: { path: { childId, discountId } } }));
}

export function useChildInvoices(childId: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "child", childId, "invoices"),
    queryFn: async () => unwrap(await api.GET("/api/v1/children/{childId}/invoices", { params: { path: { childId } } })),
  });
}

// ------------------------------------------------------------ phiếu thu

export function useInvoices(month: string, params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = { ...listQuery(params), month: monthStart(month) };
  return useQuery({
    queryKey: queryKey("finance", "invoices", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/invoices", { params: { query: query as never } })),
    placeholderData: keepPreviousData,
  });
}

export function useInvoiceSummary(month: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "invoice-summary", month),
    queryFn: async () => unwrap(await api.GET("/api/v1/invoices/summary", { params: { query: { month: monthStart(month) } } })),
  });
}

export function useInvoice(id: string | null) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "invoice", id),
    queryFn: async () => unwrap(await api.GET("/api/v1/invoices/{id}", { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

export async function generateInvoices(month: string, childIds?: string[]) {
  return unwrap(await api.POST("/api/v1/invoices/generate", { body: { month: monthStart(month), childIds } }));
}

export async function issueInvoices(month: string, ids?: string[]) {
  return unwrap(await api.POST("/api/v1/invoices/issue", { body: { month: monthStart(month), ids } }));
}

export async function issueInvoice(id: string) {
  return unwrap(await api.POST("/api/v1/invoices/{id}/issue", { params: { path: { id } } }));
}

export async function cancelInvoice(id: string, reason?: string) {
  return unwrap(await api.POST("/api/v1/invoices/{id}/cancel", { params: { path: { id } }, body: { reason } }));
}

export async function addPayment(id: string, body: S["PaymentRequest"]) {
  return unwrap(await api.POST("/api/v1/invoices/{id}/payments", { params: { path: { id } }, body }));
}

export async function voidPayment(id: string, paymentId: string, reason: string) {
  return unwrap(await api.POST("/api/v1/invoices/{id}/payments/{paymentId}/void", { params: { path: { id, paymentId } }, body: { reason } }));
}

export function invoicePdf(id: string) {
  return api.GET("/api/v1/invoices/{id}/pdf", { params: { path: { id } }, parseAs: "blob" });
}

export function exportInvoices(month: string, filters: Record<string, string>) {
  return api.GET("/api/v1/invoices/export", { params: { query: { ...filters, month: monthStart(month) } as never }, parseAs: "blob" });
}

// ------------------------------------------------------------ công nợ

export function useReceivables(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = listQuery(params);
  return useQuery({
    queryKey: queryKey("finance", "receivables", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/receivables", { params: { query: query as never } })),
    placeholderData: keepPreviousData,
  });
}

export function useReceivableSummary() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("finance", "receivable-summary"), queryFn: async () => unwrap(await api.GET("/api/v1/receivables/summary")) });
}

// ------------------------------------------------------------ sổ thu chi

export function useCashCategories() {
  return useQuery({ queryKey: ["finance", "cash-categories"], queryFn: async () => unwrap(await api.GET("/api/v1/cash-categories")) });
}

export async function createCashCategory(body: S["CreateCashCategoryRequest"]) {
  return unwrap(await api.POST("/api/v1/cash-categories", { body }));
}

export async function updateCashCategory(id: string, body: S["UpdateCashCategoryRequest"]) {
  return unwrap(await api.PUT("/api/v1/cash-categories/{id}", { params: { path: { id } }, body }));
}

export function useCashEntries(month: string, params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = { ...listQuery(params), from: monthStart(month), to: monthEnd(month) };
  return useQuery({
    queryKey: queryKey("finance", "cash-entries", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/cash-entries", { params: { query: query as never } })),
    placeholderData: keepPreviousData,
  });
}

export function useCashSummary(month: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("finance", "cash-summary", month),
    queryFn: async () => unwrap(await api.GET("/api/v1/cash-entries/summary", { params: { query: { from: monthStart(month), to: monthEnd(month) } } })),
  });
}

export async function saveCashEntry(id: string | null, body: S["CashEntryRequest"]) {
  return id
    ? unwrap(await api.PUT("/api/v1/cash-entries/{id}", { params: { path: { id } }, body }))
    : unwrap(await api.POST("/api/v1/cash-entries", { body }));
}

export async function deleteCashEntry(id: string) {
  return unwrap(await api.DELETE("/api/v1/cash-entries/{id}", { params: { path: { id } } }));
}

export async function cashEntryFileUrl(id: string) {
  return unwrap(await api.GET("/api/v1/cash-entries/{id}/file-url", { params: { path: { id } } })).url;
}
