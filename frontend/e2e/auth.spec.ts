import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("chưa đăng nhập bị chuyển tới /login, đăng nhập xong quay lại trang định mở", async ({ page }) => {
  await page.goto("/files-demo");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email hoặc số điện thoại").fill(ACCOUNTS.owner);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Matkhau@123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page).toHaveURL(/\/files-demo$/);
  await expect(page.getByRole("heading", { name: "Tệp (thử nghiệm)" })).toBeVisible();
});

test("sai mật khẩu hiện thông báo tiếng Việt", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email hoặc số điện thoại").fill(ACCOUNTS.owner);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Email/số điện thoại hoặc mật khẩu không đúng.")).toBeVisible();
});

test("chủ chuỗi đổi cơ sở trên header, đăng xuất", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await expect(page.getByText("Đang xem: Tất cả cơ sở")).toBeVisible();

  await page.getByLabel("Chọn cơ sở").click();
  await page.getByRole("option", { name: "Cơ sở B – Hoa Mai" }).click();
  await expect(page.getByText("Đang xem: Cơ sở B – Hoa Mai")).toBeVisible();

  // Lựa chọn được nhớ sau khi tải lại trang
  await page.reload();
  await expect(page.getByText("Đang xem: Cơ sở B – Hoa Mai")).toBeVisible();

  await page.getByRole("button", { name: /Chủ Chuỗi/ }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
