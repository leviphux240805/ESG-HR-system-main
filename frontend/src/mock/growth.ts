import type { components } from "@/api/schema";
import { type Lms, WHO_LMS } from "./whoLms";

type S = components["schemas"];
type Gender = "MALE" | "FEMALE";
type Indicator = keyof typeof WHO_LMS;

// Bản demo của GrowthClassifier (backend): cùng công thức z-score WHO, nhưng tra bảng theo tháng (nội suy) thay vì
// theo ngày nên có thể lệch backend ±0,01–0,02 ở 0–5 tuổi. Bản thật luôn tính ở backend.

export const DAYS_PER_MONTH = 30.4375;

function lmsAt(indicator: Indicator, gender: Gender, months: number): Lms | null {
  const table = WHO_LMS[indicator][gender];
  const low = Math.floor(months);
  if (low < 0 || low >= table.length) return null;
  const diff = months - low;
  if (diff === 0) return table[low];
  if (low + 1 >= table.length) return null;
  const [a, b] = [table[low], table[low + 1]];
  return [a[0] + diff * (b[0] - a[0]), a[1] + diff * (b[1] - a[1]), a[2] + diff * (b[2] - a[2])];
}

export const sd = ([l, m, s]: Lms, k: number) => m * Math.pow(1 + l * s * k, 1 / l);

function z(p: Lms, y: number, adjusted: boolean): number {
  const [l, m, s] = p;
  const raw = (Math.pow(y / m, l) - 1) / (s * l);
  if (adjusted && raw > 3) return 3 + (y - sd(p, 3)) / (sd(p, 3) - sd(p, 2));
  if (adjusted && raw < -3) return -3 + (y - sd(p, -3)) / (sd(p, -2) - sd(p, -3));
  return raw;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

const weightStatus = (v: number): NonNullable<S["MeasurementDto"]["weightStatus"]> =>
  v < -3 ? "SEVERE_UNDERWEIGHT" : v < -2 ? "UNDERWEIGHT" : v > 2 ? "ABOVE_NORMAL" : "NORMAL";
const heightStatus = (v: number): NonNullable<S["MeasurementDto"]["heightStatus"]> => (v < -3 ? "SEVERE_STUNTED" : v < -2 ? "STUNTED" : v > 3 ? "TALL" : "NORMAL");
function bmiStatus(v: number, who2007: boolean): NonNullable<S["MeasurementDto"]["bmiStatus"]> {
  if (v < -3) return "SEVERE_WASTED";
  if (v < -2) return "WASTED";
  if (who2007) return v > 2 ? "OBESE" : v > 1 ? "OVERWEIGHT" : "NORMAL";
  return v > 3 ? "OBESE" : v > 2 ? "OVERWEIGHT" : v > 1 ? "OVERWEIGHT_RISK" : "NORMAL";
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export type Classified = Pick<
  S["MeasurementDto"],
  "ageMonths" | "bmi" | "weightZ" | "heightZ" | "bmiZ" | "weightStatus" | "heightStatus" | "bmiStatus" | "standard"
>;

export function classify(gender: Gender, dob: string, date: string, weightKg: number, heightCm: number): Classified {
  const days = dayDiff(dob, date);
  const months = days / DAYS_PER_MONTH;
  const bmi = weightKg / (heightCm / 100) ** 2;
  const who2007 = days > 1826;
  const score = (ind: Indicator, y: number, adjusted: boolean) => {
    const p = lmsAt(ind, gender, months);
    return p ? round2(z(p, y, adjusted)) : undefined;
  };
  const wz = score("WFA", weightKg, true);
  const hz = score("HFA", heightCm, false);
  const bz = score("BFA", bmi, true);
  return {
    ageMonths: round2(months),
    bmi: round2(bmi),
    weightZ: wz,
    heightZ: hz,
    bmiZ: bz,
    weightStatus: wz == null ? undefined : weightStatus(wz),
    heightStatus: hz == null ? undefined : heightStatus(hz),
    bmiStatus: bz == null ? undefined : bmiStatus(bz, who2007),
    standard: wz == null && hz == null && bz == null ? undefined : who2007 ? "WHO_2007" : "WHO_2006",
  };
}

/** Giá trị tại `k` SD ở tháng tuổi `months` (dùng sinh dữ liệu giả). */
export function valueAt(indicator: Indicator, gender: Gender, months: number, k: number): number {
  const p = lmsAt(indicator, gender, Math.min(months, 96));
  return p ? sd(p, k) : NaN;
}

/** Đường chuẩn theo tháng 0…maxMonth. */
export function curve(indicator: Indicator, gender: Gender, maxMonth: number): S["CurvePoint"][] {
  const out: S["CurvePoint"][] = [];
  for (let month = 0; month <= Math.min(maxMonth, 96); month++) {
    const p = lmsAt(indicator, gender, month)!;
    const v = (k: number) => round2(sd(p, k));
    out.push({ ageMonths: month, sd3neg: v(-3), sd2neg: v(-2), median: v(0), sd2: v(2), sd3: v(3) });
  }
  return out;
}

export const ageInMonths = (dob: string, date: string) => dayDiff(dob, date) / DAYS_PER_MONTH;
