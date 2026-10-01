import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

// Chạy với VITE_PREVIEW_MODULES=true (playwright.config.ts) để có route của các module chưa làm.

test("giáo viên bị khóa ở cơ sở của mình, menu chỉ gồm mục được phép, vào trang không đủ quyền thấy 403", async ({ page }) => {
  await login(page, ACCOUNTS.teacherA);

  const selector = page.getByLabel("Chọn trường");
  await expect(selector).toBeDisabled();
  await expect(selector).toContainText("Trường A – Hoa Sen");

  const menu = page.getByRole("navigation", { name: "Menu chính" });
  await expect(menu.getByRole("link", { name: "Điểm danh" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Phiếu lương của tôi" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Nhân sự" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Học phí" })).toHaveCount(0);

  await page.goto("/hoc-phi/phieu-thu");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
  await page.getByRole("link", { name: "Về trang chủ" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("hiệu trưởng vào được trang quản lý (trang 'Sắp có' khi xem trước)", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/luong");
  await expect(page.getByRole("heading", { name: /Lương – sắp có/ })).toBeVisible();
});

test("đường dẫn không tồn tại → 404", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/khong-ton-tai");
  await expect(page.getByText("404")).toBeVisible();
});
