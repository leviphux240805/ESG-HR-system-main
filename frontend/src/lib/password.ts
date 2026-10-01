import { z } from "zod";

/** Cùng quy tắc với backend: ít nhất 8 ký tự, gồm cả chữ và số. */
export const PASSWORD_RULE = "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số.";

export const isStrongPassword = (value: string) => value.length >= 8 && /\p{L}/u.test(value) && /\d/.test(value);

/** Ô mật khẩu mới trong form zod. */
export const passwordField = z.string().refine(isStrongPassword, PASSWORD_RULE);
