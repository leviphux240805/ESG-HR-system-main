import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

// Chạy với VITE_PREVIEW_MODULES=true (playwright.config.ts) để có route của các module chưa làm.

test("giáo viên bị khóa ở cơ sở của mình, menu chỉ gồm mục được phép, vào trang không đủ quyền thấy 403", async ({ page }) => {
  await login(page, ACCOUNTS.teacherA);

  const selector = page.getByLabel("Chọn trường");
  await expect(selector).toBeDisabled();
  await expect(selector).toContainText("Trường A – Hoa Sen");

  const menu = page.getByRole("navigation", { name: "Menu chính" });
  await expect(menu.getByRole("link", { name: "Điểm danh", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Phiếu lương của tôi" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Nhân sự" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Học phí" })).toHaveCount(0);

  await page.goto("/hoc-phi/phieu-thu");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
  await page.getByRole("link", { name: "Về trang chủ" }).click();
  // Trang chủ chuyển tới trang đầu tiên của menu theo vai trò: giáo viên → Điểm danh
  await expect(page).toHaveURL(/\/diem-danh/);
});

test("hiệu trưởng vào được trang Bảng lương; giáo viên thì không", async ({ page, browser }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/luong");
  await expect(page.getByRole("heading", { name: "Bảng lương", exact: true })).toBeVisible();
  const teacher = await browser.newPage();
  await login(teacher, ACCOUNTS.teacherA);
  await teacher.goto("/luong");
  await expect(teacher.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
  await teacher.close();
});

test("đường dẫn không tồn tại → 404", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/khong-ton-tai");
  await expect(page.getByText("404")).toBeVisible();
});
