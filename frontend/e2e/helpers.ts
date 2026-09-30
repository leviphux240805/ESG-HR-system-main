import { type APIRequestContext, expect, type Page } from "@playwright/test";

/** Mật khẩu chung của tài khoản seed dev (backend/src/main/resources/db/dev/R__dev_seed.sql). */
export const SEED_PASSWORD = "Matkhau@123";

export const ACCOUNTS = {
  owner: "owner@preschool.local",
  teacherA: "0900000005",
  staffB: "0900000008",
} as const;

export async function login(page: Page, identifier: string, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Email hoặc số điện thoại").fill(identifier);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByLabel("Chọn cơ sở")).toBeVisible();
}

export const SCHOOL_A = "00000000-0000-0000-0000-00000000000a";

export const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

/** Gọi API trực tiếp (qua proxy của Vite) để chuẩn bị dữ liệu cho test, không đi qua giao diện. */
export async function apiAs(request: APIRequestContext, identifier: string, schoolId?: string) {
  const login = await request.post("/api/v1/auth/login", { data: { identifier, password: SEED_PASSWORD } });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = await login.json();
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (schoolId) headers["X-School-Id"] = schoolId;
  return {
    async post<T = Record<string, unknown>>(path: string, data: unknown): Promise<T> {
      const res = await request.post(path, { data, headers });
      expect(res.ok(), await res.text()).toBeTruthy();
      return res.json();
    },
  };
}

/** Tạo nhân viên mới (dữ liệu riêng mỗi lần chạy) ở Cơ sở A. */
export async function createStaffA(request: APIRequestContext, fullName: string) {
  const api = await apiAs(request, "0900000004", SCHOOL_A);
  return api.post<{ id: string; staffCode: string; fullName: string; phone: string }>("/api/v1/staff", {
    schoolId: SCHOOL_A,
    fields: { fullName, phone: "07" + randomDigits(8), position: "TEACHER", startDate: "2026-09-01" },
  });
}
