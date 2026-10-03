import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

type S = components["schemas"];
export type PayrollSheet = S["PayrollSheet"];
export type PayrollRow = S["PayrollRow"];
export type Payslip = S["Payslip"];
export type MyPayslip = S["MyPayslip"];
export type PayrollStatus = NonNullable<PayrollSheet["status"]>;

export const PAYROLL_STATUS: Record<PayrollStatus | "NONE", StatusMeta> = {
  NONE: { label: "Chưa tính", tone: "neutral" },
  DRAFT: { label: "Nháp", tone: "warning" },
  APPROVED: { label: "Đã duyệt", tone: "info" },
  PAID: { label: "Đã trả", tone: "success" },
};

export function usePayrollSheet(month: string, enabled = true) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("payroll", month),
    queryFn: async () => unwrap(await api.GET("/api/v1/payroll/periods/{month}", { params: { path: { month } } })),
    enabled,
  });
}

export async function calculatePayroll(month: string) {
  return unwrap(await api.POST("/api/v1/payroll/periods/{month}/calculate", { params: { path: { month } } }));
}

export async function adjustPayrollRecord(id: string, body: S["AdjustRequest"]) {
  return unwrap(await api.PUT("/api/v1/payroll/records/{id}", { params: { path: { id } }, body }));
}

export async function approvePayroll(month: string) {
  return unwrap(await api.POST("/api/v1/payroll/periods/{month}/approve", { params: { path: { month } } }));
}

export async function reopenPayroll(month: string, reason: string) {
  return unwrap(await api.POST("/api/v1/payroll/periods/{month}/reopen", { params: { path: { month } }, body: { reason } }));
}

export async function payPayroll(month: string) {
  return unwrap(await api.POST("/api/v1/payroll/periods/{month}/pay", { params: { path: { month } } }));
}

export function exportPayroll(month: string) {
  return api.GET("/api/v1/payroll/periods/{month}/export", { params: { path: { month } }, parseAs: "blob" });
}

export function usePayslip(id: string | null) {
  return useQuery({
    queryKey: ["payroll", "payslip", id],
    queryFn: async () => unwrap(await api.GET("/api/v1/payroll/records/{id}", { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

export function payslipPdf(id: string) {
  return api.GET("/api/v1/payroll/records/{id}/pdf", { params: { path: { id } }, parseAs: "blob" });
}

export function useMyPayslips() {
  return useQuery({ queryKey: ["me", "payslips"], queryFn: async () => unwrap(await api.GET("/api/v1/me/payslips")) });
}
