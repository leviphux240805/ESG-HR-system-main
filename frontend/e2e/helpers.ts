import { expect, type Page } from "@playwright/test";

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
