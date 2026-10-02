import type { components } from "@/api/schema";
import { db } from "./db";
import { holidayName, weekday } from "./dates";

type ConfigDto = components["schemas"]["ConfigDto"];

/** Cấu hình mặc định của bản demo, như cấu hình seed của backend (thứ Bảy nửa buổi). */
const DEFAULT: Omit<ConfigDto, "id" | "schoolId"> = {
  effectiveFrom: "2020-01-01",
  shiftStart: "07:30:00",
  shiftEnd: "17:00:00",
  lunchStart: "11:30:00",
  lunchEnd: "13:00:00",
  graceMinutes: 15,
  maxLateAllowed: 3,
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  halfDayWeekdays: [6],
  annualLeaveDays: 12,
};

/** Các bản cấu hình của trường, mới nhất trước; trường chưa có thì dùng bản mặc định. */
export function configVersions(schoolId: string): ConfigDto[] {
  const list = (db().attendanceConfigs ??= []);
  if (!list.some((c) => c.schoolId === schoolId)) list.push({ ...DEFAULT, id: `cfg-${schoolId}`, schoolId });
  return list.filter((c) => c.schoolId === schoolId).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

/** Bản cấu hình đang áp dụng tại ngày `date`. */
export function configAt(schoolId: string, date: string): ConfigDto {
  const versions = configVersions(schoolId);
  return versions.find((c) => c.effectiveFrom <= date) ?? versions[versions.length - 1];
}

export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Ngày làm việc của trường theo cấu hình đang áp dụng, trừ ngày lễ. */
export function isWorkingDay(schoolId: string, date: string): boolean {
  return configAt(schoolId, date).workingWeekdays.includes(weekday(date)) && !holidayName(date, schoolId);
}
