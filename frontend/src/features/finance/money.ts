import { z } from "zod";

/** "1.500.000" → 1500000; chuỗi không có chữ số → NaN. */
export function parseMoney(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : Number.NaN;
}

/** Ô tiền dạng chuỗi (cho phép dấu chấm phân cách), giá trị ≥ min. */
export const moneyInput = (min = 1, message = "Vui lòng nhập số tiền hợp lệ") =>
  z
    .string()
    .trim()
    .refine((v) => /^[\d.\s]+$/.test(v) && parseMoney(v) >= min, message);
