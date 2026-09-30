import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { Dashboard } from "@/mock/types";

export type { Dashboard };

export function useDashboard() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("reports", "dashboard"), queryFn: () => apiRequest<Dashboard>("GET", "/reports/dashboard") });
}
