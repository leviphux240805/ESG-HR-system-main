import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

type S = components["schemas"];
export type Dashboard = S["Dashboard"];
export type SchoolMetrics = S["SchoolMetrics"];

export type ReportName = "staff-attendance" | "payroll" | "receivables" | "children";

export function useDashboard() {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("reports", "dashboard"),
    queryFn: async () => unwrap(await api.GET("/api/v1/reports/dashboard")),
  });
}

/** Xuất Excel báo cáo; `month` dạng "2026-09". */
export function exportReport(name: ReportName, month: string) {
  return api.GET("/api/v1/reports/{name}/export", { params: { path: { name }, query: { month } }, parseAs: "blob" });
}
