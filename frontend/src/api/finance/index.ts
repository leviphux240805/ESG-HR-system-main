import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";
import type { DebtItem, FeeSummary, InvoiceDetail, InvoiceItem, InvoiceStatus, Page } from "@/api/contracts";

export type { DebtItem, FeeSummary, InvoiceDetail, InvoiceItem, InvoiceStatus };

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  PAID: { label: "Đã thu đủ", tone: "success" },
  PARTIAL: { label: "Thu một phần", tone: "warning" },
  UNPAID: { label: "Chưa thu", tone: "danger" },
};

export const INVOICE_FILTER_KEYS = ["status", "classId"] as const;

export function useInvoices(month: string, params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = { ...(params.apiParams as Record<string, string | number | undefined>), month };
  return useQuery({
    queryKey: queryKey("invoices", "list", query),
    queryFn: () => apiRequest<Page<InvoiceItem>>("GET", "/invoices", { query }),
    placeholderData: keepPreviousData,
  });
}

export function useFeeSummary(month: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("invoices", "summary", month), queryFn: () => apiRequest<FeeSummary>("GET", "/invoices/summary", { query: { month } }) });
}

export function useInvoice(id: string | null) {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("invoices", id), queryFn: () => apiRequest<InvoiceDetail>("GET", `/invoices/${id}`), enabled: !!id });
}

export function useDebts() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("invoices", "debts"), queryFn: () => apiRequest<DebtItem[]>("GET", "/debts") });
}

export const recordPayment = (id: string, body: { amount: number; method: "CASH" | "TRANSFER"; date: string }) =>
  apiRequest<InvoiceDetail>("POST", `/invoices/${id}/payments`, { body });
