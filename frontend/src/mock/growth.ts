import type { Gender, ReferencePoint } from "./types";

// Chuẩn tăng trưởng WHO (xấp xỉ, làm tròn) theo tháng tuổi 24–72: [-2SD, trung vị, +2SD]. Chỉ dùng cho bản demo.
const AGES = [24, 36, 48, 60, 72];
const WEIGHT: Record<Gender, number[][]> = {
  MALE: [[9.7, 12.2, 15.3], [11.3, 14.3, 18.3], [12.7, 16.3, 21.2], [14.1, 18.3, 24.2], [15.9, 20.5, 27.1]],
  FEMALE: [[9.0, 11.5, 14.8], [10.8, 13.9, 18.1], [12.3, 16.1, 21.5], [13.7, 18.2, 24.9], [15.3, 20.2, 27.8]],
};
const HEIGHT: Record<Gender, number[][]> = {
  MALE: [[81.0, 87.1, 93.2], [88.7, 96.1, 103.5], [94.9, 103.3, 111.7], [100.7, 110.0, 119.2], [106.1, 116.0, 125.8]],
  FEMALE: [[79.3, 85.7, 92.2], [87.4, 95.1, 102.7], [94.1, 102.7, 111.3], [99.9, 109.4, 118.9], [104.9, 115.1, 125.4]],
};

function interpolate(table: number[][], age: number): [number, number, number] {
  const a = Math.min(Math.max(age, AGES[0]), AGES[AGES.length - 1]);
  const i = Math.min(Math.floor((a - AGES[0]) / 12), AGES.length - 2);
  const t = (a - AGES[i]) / 12;
  return [0, 1, 2].map((k) => table[i][k] + (table[i + 1][k] - table[i][k]) * t) as [number, number, number];
}

export function reference(kind: "weight" | "height", gender: Gender, age: number) {
  const [low, median, high] = interpolate((kind === "weight" ? WEIGHT : HEIGHT)[gender], age);
  return { low, median, high };
}

export function referenceSeries(kind: "weight" | "height", gender: Gender, from: number, to: number): ReferencePoint[] {
  const out: ReferencePoint[] = [];
  for (let age = from; age <= to; age++) {
    const r = reference(kind, gender, age);
    out.push({ ageMonths: age, low: +r.low.toFixed(1), median: +r.median.toFixed(1), high: +r.high.toFixed(1) });
  }
  return out;
}

/** Z-score xấp xỉ: nửa dưới/trên trung vị dùng độ lệch chuẩn riêng. */
export function zScore(kind: "weight" | "height", gender: Gender, age: number, value: number): number {
  const { low, median, high } = reference(kind, gender, age);
  return value < median ? (value - median) / ((median - low) / 2) : (value - median) / ((high - median) / 2);
}

export function valueAt(kind: "weight" | "height", gender: Gender, age: number, z: number): number {
  const { low, median, high } = reference(kind, gender, age);
  return z < 0 ? median + (z * (median - low)) / 2 : median + (z * (high - median)) / 2;
}

/** Đánh giá dinh dưỡng theo cân nặng/chiều cao theo tuổi. */
export function nutritionStatus(gender: Gender, age: number, heightCm: number, weightKg: number): string[] {
  const status: string[] = [];
  const zw = zScore("weight", gender, age, weightKg);
  const zh = zScore("height", gender, age, heightCm);
  if (zw < -2) status.push("Suy dinh dưỡng nhẹ cân");
  if (zw > 2) status.push("Thừa cân");
  if (zh < -2) status.push("Thấp còi");
  return status.length ? status : ["Bình thường"];
}
