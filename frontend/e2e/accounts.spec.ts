import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, randomDigits } from "./helpers";

test("hiệu trưởng tạo tài khoản, gán thêm vai trò, khóa và mở khóa", async ({ page }) => {
  const email = `tk.${randomDigits(6)}@e2e.local`;
  const name = `Tài Khoản Thử ${randomDigits(4)}`;
  await login(page, ACCOUNTS.owner);
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();

  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Họ tên").fill(name);
  await sheet.getByLabel("Email đăng nhập").fill(email);
  await sheet.getByLabel("Vai trò 1", { exact: true }).click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  await sheet.getByRole("button", { name: "Tạo và gửi email mời" }).click();
  // Vai trò phải gắn một trường
  await expect(sheet.getByText("Chọn trường cho vai trò này")).toBeVisible();
  await sheet.getByLabel("Trường 1", { exact: true }).click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await sheet.getByRole("button", { name: "Tạo và gửi email mời" }).click();
  await expect(page.getByText("Đã tạo tài khoản và gửi email mời.")).toBeVisible();

  await page.getByLabel("Tìm theo tên, email, SĐT").fill(email);
  await expect(page).toHaveURL(/q=/);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Giáo viên · Trường A – Hoa Sen");
  await expect(row).toContainText("Chưa đăng nhập");

  // Gán thêm vai trò phó hiệu trưởng ở trường B (bắt buộc chọn nhóm chức năng)
  await row.getByRole("button", { name: `Thao tác tài khoản ${name}` }).click();
  await page.getByRole("menuitem", { name: "Sửa vai trò" }).click();
  const roles = page.getByRole("dialog");
  await roles.getByRole("button", { name: "Thêm vai trò" }).click();
  await roles.getByLabel("Vai trò 2", { exact: true }).click();
  await page.getByRole("option", { name: "Phó hiệu trưởng" }).click();
  await roles.getByLabel("Trường 2", { exact: true }).click();
  await page.getByRole("option", { name: "Trường B – Hoa Mai" }).click();
  await roles.getByRole("button", { name: "Lưu" }).click();
  await expect(roles.getByText("Chọn ít nhất một nhóm chức năng")).toBeVisible();
  await roles.getByRole("group", { name: "Nhóm chức năng 2" }).getByLabel("Lớp & trẻ").check();
  await roles.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu vai trò.")).toBeVisible();
  await expect(row).toContainText("Phó hiệu trưởng · Trường B – Hoa Mai");
  await expect(row).toContainText("Lớp & trẻ");

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

test("tài khoản hiệu trưởng không sửa vai trò, không khóa được; phó hiệu trưởng không vào được trang Tài khoản", async ({ page, browser }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/tai-khoan?q=owner%40preschool.local");
  const self = page.getByRole("row").filter({ hasText: ACCOUNTS.owner });
  await expect(self).toContainText("(bạn)");
  await self.getByRole("button", { name: /^Thao tác tài khoản/ }).click();
  await expect(page.getByRole("menuitem", { name: "Gửi email đặt lại mật khẩu" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sửa vai trò" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Khóa tài khoản" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await expect(principal.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
  await principal.goto("/tai-khoan");
  await expect(principal.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
  await principal.close();
});
