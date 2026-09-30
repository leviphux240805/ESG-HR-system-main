import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

type S = components["schemas"];
export type MonthSheet = S["MonthSheet"];
export type StaffRow = S["StaffRow"];
export type SheetCell = S["Cell"];
export type DayInfo = S["DayInfo"];
export type CellDetail = S["CellDetail"];
export type DiscrepancyItem = S["DiscrepancyItem"];
export type ImportResult = S["ImportResult"];
export type MySheet = S["MySheet"];

export function useMonthSheet(month: string, enabled = true) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("attendance", "sheet", month),
    queryFn: async () => unwrap(await api.GET("/api/v1/attendance/staff", { params: { query: { month } } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCellDetail(staffId: string | undefined, date: string | undefined) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("attendance", "cell", staffId, date),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/attendance/staff/{staffId}/{date}", { params: { path: { staffId: staffId!, date: date! } } }),
      ),
    enabled: !!staffId && !!date,
  });
}

export function useDiscrepancies(month: string, enabled: boolean) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("attendance", "discrepancies", month),
    queryFn: async () => unwrap(await api.GET("/api/v1/attendance/discrepancies", { params: { query: { month } } })),
    enabled,
  });
}

export function useMySheet(month: string) {
  return useQuery({
    queryKey: ["me", "attendance", month],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/attendance", { params: { query: { month } } })),
    placeholderData: keepPreviousData,
  });
}
