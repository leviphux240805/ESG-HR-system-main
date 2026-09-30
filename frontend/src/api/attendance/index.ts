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

// ------------------------------------------------------------ cấu hình, ngày lễ, sửa ô, khóa tháng

export type AttendanceConfigDto = S["ConfigOverview"];
export type HolidayDto = S["HolidayDto"];

export function useAttendanceConfig(schoolId: string | null) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("attendance", "configs"),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/attendance/configs", { params: { query: { schoolId: schoolId ?? undefined } } })),
  });
}

export async function addAttendanceConfig(body: S["CreateConfigRequest"]) {
  return unwrap(await api.POST("/api/v1/attendance/configs", { body }));
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: ["holidays", year],
    queryFn: async () => unwrap(await api.GET("/api/v1/holidays", { params: { query: { year } } })),
  });
}

export async function addHolidays(body: S["CreateHolidayRequest"]) {
  return unwrap(await api.POST("/api/v1/holidays", { body }));
}

export async function deleteHoliday(id: string) {
  return unwrap(await api.DELETE("/api/v1/holidays/{id}", { params: { path: { id } } }));
}

export async function updateAttendanceCell(staffId: string, date: string, body: S["UpdateCellRequest"]) {
  return unwrap(await api.PUT("/api/v1/attendance/staff/{staffId}/{date}", { params: { path: { staffId, date } }, body }));
}

export async function importPunches(body: S["ImportRequest"]) {
  return unwrap(await api.POST("/api/v1/attendance/imports", { body }));
}

export async function resolveDiscrepancies(body: S["ResolveRequest"]) {
  return unwrap(await api.POST("/api/v1/attendance/discrepancies/resolve", { body }));
}

export async function lockMonth(month: string) {
  return unwrap(await api.POST("/api/v1/attendance/months/{month}/lock", { params: { path: { month } } }));
}

export async function unlockMonth(month: string, reason: string) {
  return unwrap(
    await api.POST("/api/v1/attendance/months/{month}/unlock", { params: { path: { month } }, body: { reason } }),
  );
}

/** Tải bảng công tháng dạng Excel (trả nguyên response để ExportButton lấy tên file). */
export function exportMonth(month: string) {
  return api.GET("/api/v1/attendance/months/{month}/export", { params: { path: { month } }, parseAs: "blob" });
}
