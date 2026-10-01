import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";

type S = components["schemas"];
export type Dish = S["DishDto"];
export type DishRequest = S["DishRequest"];
export type Ingredient = S["Ingredient"];
export type MenuWeek = S["MenuWeekDto"];
export type MenuItem = S["MenuItemDto"];
export type MenuItemRequest = S["MenuItemRequest"];
export type AllergyWarning = S["AllergyWarning"];
export type Meal = MenuItem["meal"];
export type MeasurementDto = S["MeasurementDto"];
export type MeasurementRow = S["MeasurementRow"];
export type ClassMeasurementSheet = S["ClassMeasurementSheet"];
export type MeasurementSource = MeasurementDto["source"];
export type GrowthChartData = S["GrowthChart"];
export type CurvePoint = S["CurvePoint"];
export type ChildHealth = S["ChildHealth"];
export type HealthLog = S["HealthLogDto"];
export type HealthLogType = HealthLog["type"];
export type Checkup = S["CheckupDto"];
export type WeightStatus = NonNullable<MeasurementDto["weightStatus"]>;
export type HeightStatus = NonNullable<MeasurementDto["heightStatus"]>;
export type BmiStatus = NonNullable<MeasurementDto["bmiStatus"]>;

export const MEALS: Meal[] = ["BREAKFAST", "LUNCH", "AFTERNOON", "SNACK"];

export const MEAL_LABELS: Record<Meal, string> = { BREAKFAST: "Bữa sáng", LUNCH: "Bữa trưa", AFTERNOON: "Bữa chiều", SNACK: "Bữa phụ" };

export const MENU_STATUS: Record<MenuWeek["status"], StatusMeta> = {
  DRAFT: { label: "Nháp", tone: "neutral" },
  PUBLISHED: { label: "Đã công bố", tone: "success" },
};

export const WEIGHT_STATUS: Record<WeightStatus, StatusMeta> = {
  SEVERE_UNDERWEIGHT: { label: "Nhẹ cân nặng", tone: "danger" },
  UNDERWEIGHT: { label: "Nhẹ cân", tone: "warning" },
  NORMAL: { label: "Bình thường", tone: "success" },
  ABOVE_NORMAL: { label: "Cân nặng cao", tone: "info" },
};

export const HEIGHT_STATUS: Record<HeightStatus, StatusMeta> = {
  SEVERE_STUNTED: { label: "Thấp còi nặng", tone: "danger" },
  STUNTED: { label: "Thấp còi", tone: "warning" },
  NORMAL: { label: "Bình thường", tone: "success" },
  TALL: { label: "Rất cao", tone: "info" },
};

export const BMI_STATUS: Record<BmiStatus, StatusMeta> = {
  SEVERE_WASTED: { label: "Gầy còm nặng", tone: "danger" },
  WASTED: { label: "Gầy còm", tone: "warning" },
  NORMAL: { label: "Bình thường", tone: "success" },
  OVERWEIGHT_RISK: { label: "Nguy cơ thừa cân", tone: "info" },
  OVERWEIGHT: { label: "Thừa cân", tone: "warning" },
  OBESE: { label: "Béo phì", tone: "danger" },
};

export const SOURCE_LABELS: Record<MeasurementSource, string> = { CLASS: "Cân đo tại lớp", CHECKUP: "Khám định kỳ", PARENT: "Phụ huynh báo" };

export const STANDARD_LABELS: Record<NonNullable<MeasurementDto["standard"]>, string> = {
  WHO_2006: "WHO 2006 (0–5 tuổi)",
  WHO_2007: "WHO 2007 (5–19 tuổi)",
};

export const HEALTH_LOG_TYPE: Record<HealthLogType, StatusMeta> = {
  FEVER: { label: "Sốt", tone: "danger" },
  MEDICINE: { label: "Dặn thuốc", tone: "info" },
  INCIDENT: { label: "Sự cố", tone: "warning" },
  OTHER: { label: "Khác", tone: "neutral" },
};

/** Có chỉ số nào ngoài kênh bình thường (cần theo dõi). */
export const needsAttention = (m: Pick<MeasurementDto, "weightStatus" | "heightStatus" | "bmiStatus">) =>
  [m.weightStatus, m.heightStatus, m.bmiStatus].some((s) => s && s !== "NORMAL");

export const DISH_FILTER_KEYS = ["shared", "active"] as const;
export const HEALTH_LOG_FILTER_KEYS = ["classId", "type", "from", "to"] as const;

const listQuery = (params: ListParams) => params.apiParams as Record<string, string | number | undefined>;

// ------------------------------------------------------------ món ăn

export function useDishes(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = listQuery(params);
  return useQuery({
    queryKey: queryKey("menu", "dishes", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/dishes", { params: { query: query as never } })),
    placeholderData: keepPreviousData,
  });
}

/** Món đang dùng để chọn khi lên thực đơn (tìm theo tên, tối đa 100). */
export function useDishOptions(q: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("menu", "dish-options", q),
    queryFn: async () => unwrap(await api.GET("/api/v1/dishes", { params: { query: { q: q || undefined, active: true, size: 100, page: 0 } as never } })),
    placeholderData: keepPreviousData,
  });
}

export async function saveDish(id: string | null, body: DishRequest) {
  return id
    ? unwrap(await api.PUT("/api/v1/dishes/{id}", { params: { path: { id } }, body }))
    : unwrap(await api.POST("/api/v1/dishes", { body }));
}

export async function deleteDish(id: string) {
  return unwrap(await api.DELETE("/api/v1/dishes/{id}", { params: { path: { id } } }));
}

// ------------------------------------------------------------ thực đơn tuần

export function useMenuWeek(weekStart: string, ageGroupId?: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("menu", "week", weekStart, ageGroupId),
    queryFn: async () => unwrap(await api.GET("/api/v1/menus/week", { params: { query: { weekStart, ageGroupId } } })),
    placeholderData: keepPreviousData,
  });
}

export function useAllergyWarnings(weekStart: string, ageGroupId?: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("menu", "allergy", weekStart, ageGroupId),
    queryFn: async () => unwrap(await api.GET("/api/v1/menus/allergy-warnings", { params: { query: { weekStart, ageGroupId } } })),
  });
}

export async function saveMenuWeek(body: S["SaveMenuRequest"]) {
  return unwrap(await api.PUT("/api/v1/menus/week", { body }));
}

export async function copyMenuWeek(body: S["CopyMenuRequest"]) {
  return unwrap(await api.POST("/api/v1/menus/copy", { body }));
}

export async function publishMenu(id: string, publish: boolean) {
  return publish
    ? unwrap(await api.POST("/api/v1/menus/{id}/publish", { params: { path: { id } } }))
    : unwrap(await api.POST("/api/v1/menus/{id}/unpublish", { params: { path: { id } } }));
}

// ------------------------------------------------------------ cân đo, hồ sơ sức khỏe

export function useClassMeasurements(classId: string | undefined, date: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("health", "measurements", classId, date),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/classes/{classId}/measurements", { params: { path: { classId: classId! }, query: { date } } })),
    enabled: !!classId,
  });
}

export async function saveClassMeasurements(classId: string, body: S["SaveMeasurementsRequest"]) {
  return unwrap(await api.PUT("/api/v1/classes/{classId}/measurements", { params: { path: { classId } }, body }));
}

export async function deleteMeasurement(id: string) {
  return unwrap(await api.DELETE("/api/v1/measurements/{id}", { params: { path: { id } } }));
}

export function useChildHealth(childId: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("health", "child", childId),
    queryFn: async () => unwrap(await api.GET("/api/v1/children/{childId}/health", { params: { path: { childId } } })),
  });
}

export async function addCheckup(childId: string, body: S["CheckupRequest"]) {
  return unwrap(await api.POST("/api/v1/children/{childId}/checkups", { params: { path: { childId } }, body }));
}

export async function deleteCheckup(id: string) {
  return unwrap(await api.DELETE("/api/v1/checkups/{id}", { params: { path: { id } } }));
}

export async function checkupFileUrl(id: string) {
  return unwrap(await api.GET("/api/v1/checkups/{id}/file-url", { params: { path: { id } } })).url;
}

// ------------------------------------------------------------ sổ theo dõi

export function useHealthLogs(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = listQuery(params);
  return useQuery({
    queryKey: queryKey("health", "logs", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/health-logs", { params: { query: query as never } })),
    placeholderData: keepPreviousData,
  });
}

export async function saveHealthLog(id: string | null, body: S["HealthLogRequest"]) {
  return id
    ? unwrap(await api.PUT("/api/v1/health-logs/{id}", { params: { path: { id } }, body }))
    : unwrap(await api.POST("/api/v1/health-logs", { body }));
}

export async function notifyParent(id: string) {
  return unwrap(await api.POST("/api/v1/health-logs/{id}/notify-parent", { params: { path: { id } } }));
}

export async function deleteHealthLog(id: string) {
  return unwrap(await api.DELETE("/api/v1/health-logs/{id}", { params: { path: { id } } }));
}
