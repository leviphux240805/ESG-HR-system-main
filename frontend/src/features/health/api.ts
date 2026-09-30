import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { DayMenu, GrowthChart, GrowthRow, Measurement, WeekMenu } from "@/mock/types";

export type { DayMenu, GrowthChart, GrowthRow, Measurement, WeekMenu };

export function useWeekMenu(week: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("menus", week),
    queryFn: () => apiRequest<WeekMenu>("GET", "/menus", { query: { week } }),
    placeholderData: keepPreviousData,
  });
}

export const saveDayMenu = (menuId: string, day: DayMenu) => apiRequest<WeekMenu>("PUT", `/menus/${menuId}/days/${day.date}`, { body: day });

export function useGrowth(classId: string | undefined) {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("growth", "class", classId), queryFn: () => apiRequest<GrowthRow[]>("GET", "/growth", { query: { classId } }), enabled: !!classId });
}

export function useGrowthChart(childId: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("growth", childId), queryFn: () => apiRequest<GrowthChart>("GET", `/growth/${childId}`) });
}

export const addMeasurement = (body: { childId: string; date: string; heightCm: number; weightKg: number }) =>
  apiRequest<Measurement>("POST", "/growth", { body });

/** Nhãn "Bình thường" là tốt, còn lại là cần theo dõi. */
export const isNormal = (status: string[]) => status.length === 1 && status[0] === "Bình thường";
