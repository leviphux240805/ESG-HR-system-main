import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("chưa đăng nhập bị chuyển tới /login, đăng nhập xong quay lại trang định mở", async ({ page }) => {
  await page.goto("/cua-toi/phieu-luong");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email hoặc số điện thoại").fill(ACCOUNTS.owner);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Matkhau@123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page).toHaveURL(/\/cua-toi\/phieu-luong$/);
  await expect(page.getByRole("heading", { name: "Phiếu lương của tôi" })).toBeVisible();
});

test("sai mật khẩu hiện thông báo tiếng Việt", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email hoặc số điện thoại").fill(ACCOUNTS.owner);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Email/số điện thoại hoặc mật khẩu không đúng.")).toBeVisible();
});

test("hiệu trưởng 3 trường đổi trường trên header, đăng xuất", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  const selector = page.getByLabel("Chọn trường");
  await expect(selector).toContainText("Tất cả trường");

  await selector.click();
  await expect(page.getByRole("option")).toHaveCount(4);
  await page.getByRole("option", { name: "Trường B – Hoa Mai" }).click();
  await expect(selector).toContainText("Trường B – Hoa Mai");

  // Lựa chọn được nhớ sau khi tải lại trang
  await page.reload();
  await expect(page.getByLabel("Chọn trường")).toContainText("Trường B – Hoa Mai");

  await page.getByRole("button", { name: /Hiệu Trưởng Chuỗi Hoa/ }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
