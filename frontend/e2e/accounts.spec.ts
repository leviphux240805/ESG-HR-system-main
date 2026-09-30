import { expect, test } from "@playwright/test";
import { login, randomDigits } from "./helpers";

test("văn phòng điều hành tạo tài khoản, gán thêm vai trò, khóa và mở khóa", async ({ page }) => {
  const email = `tk.${randomDigits(6)}@e2e.local`;
  const name = `Tài Khoản Thử ${randomDigits(4)}`;
  await login(page, "admin@preschool.local");
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();

  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Họ tên").fill(name);
  await sheet.getByLabel("Email đăng nhập").fill(email);
  await sheet.getByLabel("Vai trò 1", { exact: true }).click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  await sheet.getByRole("button", { name: "Tạo và gửi email mời" }).click();
  // Vai trò cơ sở phải chọn cơ sở
  await expect(sheet.getByText("Chọn cơ sở cho vai trò này")).toBeVisible();
  await sheet.getByLabel("Cơ sở 1", { exact: true }).click();
  await page.getByRole("option", { name: "Cơ sở A – Hoa Sen" }).click();
  await sheet.getByRole("button", { name: "Tạo và gửi email mời" }).click();
  await expect(page.getByText("Đã tạo tài khoản và gửi email mời.")).toBeVisible();

  await page.getByLabel("Tìm theo tên, email, SĐT").fill(email);
  await expect(page).toHaveURL(/q=/);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Giáo viên · Cơ sở A – Hoa Sen");
  await expect(row).toContainText("Chưa đăng nhập");

  // Gán thêm vai trò ở Cơ sở B
  await row.getByRole("button", { name: `Thao tác tài khoản ${name}` }).click();
  await page.getByRole("menuitem", { name: "Sửa vai trò" }).click();
  const roles = page.getByRole("dialog");
  await roles.getByRole("button", { name: "Thêm vai trò" }).click();
  await roles.getByLabel("Vai trò 2", { exact: true }).click();
  await page.getByRole("option", { name: "Nhân viên y tế" }).click();
  await roles.getByLabel("Cơ sở 2", { exact: true }).click();
  await page.getByRole("option", { name: "Cơ sở B – Hoa Mai" }).click();
  await roles.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu vai trò.")).toBeVisible();
  await expect(row).toContainText("Nhân viên y tế · Cơ sở B – Hoa Mai");

  // Khóa rồi mở khóa
  await row.getByRole("button", { name: `Thao tác tài khoản ${name}` }).click();
  await page.getByRole("menuitem", { name: "Khóa tài khoản" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Khóa" }).click();
  await expect(row).toContainText("Đã khóa");
  await row.getByRole("button", { name: `Thao tác tài khoản ${name}` }).click();
  await page.getByRole("menuitem", { name: "Mở khóa" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mở khóa" }).click();
  await expect(row).toContainText("Đang hoạt động");
});

test("không tự khóa được tài khoản của mình; hiệu trưởng không vào được trang Tài khoản", async ({ page, browser }) => {
  await login(page, "admin@preschool.local");
  await page.goto("/tai-khoan?q=admin%40preschool.local");
  const self = page.getByRole("row").filter({ hasText: "admin@preschool.local" });
  await expect(self).toContainText("(bạn)");
  await self.getByRole("button", { name: /^Thao tác tài khoản/ }).click();
  await expect(page.getByRole("menuitem", { name: "Sửa vai trò" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Khóa tài khoản" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await expect(principal.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
  await principal.goto("/tai-khoan");
  await expect(principal.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
  await principal.close();
});
