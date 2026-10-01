import { describe, expect, it } from "vitest";
import { isStrongPassword, passwordField } from "./password";

describe("isStrongPassword", () => {
  it("cần ít nhất 8 ký tự, có chữ và số", () => {
    expect(isStrongPassword("Batdau2026")).toBe(true);
    expect(isStrongPassword("mậtkhẩu1")).toBe(true);
    expect(isStrongPassword("12345678")).toBe(false);
    expect(isStrongPassword("abcdefgh")).toBe(false);
    expect(isStrongPassword("abc123")).toBe(false);
  });

  it("passwordField báo lỗi tiếng Việt", () => {
    const result = passwordField.safeParse("123");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/ít nhất 8 ký tự/);
  });
});
