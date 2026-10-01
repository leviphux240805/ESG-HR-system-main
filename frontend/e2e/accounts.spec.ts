import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, randomDigits } from "./helpers";

test("hiệu trưởng tạo tài khoản bằng số điện thoại, gán thêm vai trò, khóa và mở khóa", async ({ page }) => {
  const phone = "06" + randomDigits(8);
  const name = `Tài Khoản Thử ${randomDigits(4)}`;
  await login(page, ACCOUNTS.owner);
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();

  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Họ tên").fill(name);
  await sheet.getByLabel("Số điện thoại đăng nhập").fill(phone);
  await sheet.getByLabel("Mật khẩu ban đầu").fill("Batdau2026");
  await sheet.getByLabel("Vai trò 1", { exact: true }).click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  await sheet.getByRole("button", { name: "Tạo tài khoản" }).click();
  // Vai trò phải gắn một trường
  await expect(sheet.getByText("Chọn trường cho vai trò này")).toBeVisible();
  await sheet.getByLabel("Trường 1", { exact: true }).click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await sheet.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByText("Đã tạo tài khoản.")).toBeVisible();

  await page.getByLabel("Tìm theo tên, email, SĐT").fill(phone);
  await expect(page).toHaveURL(/q=/);
  const row = page.getByRole("row").filter({ hasText: phone });
  await expect(row).toContainText("Giáo viên · Trường A – Hoa Sen");
  await expect(row).toContainText("Chưa đăng nhập");
  await expect(row).toContainText("Chờ đổi mật khẩu");

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

test("người dùng đổi mật khẩu được cấp ở lần đăng nhập đầu, hiệu trưởng đặt lại thì phải đổi lại", async ({ page, browser }) => {
  const phone = "06" + randomDigits(8);
  const name = `Đổi Mật Khẩu ${randomDigits(4)}`;
  await login(page, ACCOUNTS.owner);
  await page.goto("/tai-khoan");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Họ tên").fill(name);
  await sheet.getByLabel("Số điện thoại đăng nhập").fill(phone);
  await sheet.getByLabel("Mật khẩu ban đầu").fill("Batdau2026");
  await sheet.getByLabel("Vai trò 1", { exact: true }).click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  await sheet.getByLabel("Trường 1", { exact: true }).click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await sheet.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByText("Đã tạo tài khoản.")).toBeVisible();

  const user = await browser.newPage();
  const signIn = async (password: string) => {
    await user.goto("/login");
    await user.getByLabel("Email hoặc số điện thoại").fill(phone);
    await user.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await user.getByRole("button", { name: "Đăng nhập" }).click();
  };
  await signIn("Batdau2026");
  await expect(user).toHaveURL(/\/doi-mat-khau/);
  await user.goto("/");
  await expect(user).toHaveURL(/\/doi-mat-khau/);
  await user.getByLabel("Mật khẩu được cấp").fill("Batdau2026");
  await user.getByLabel(/^Mật khẩu mới/).fill("Riengtoi2026");
  await user.getByLabel("Nhập lại mật khẩu mới").fill("Riengtoi2026");
  await user.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(user.getByText("Đã đổi mật khẩu.")).toBeVisible();
  await expect(user.getByLabel("Chọn trường")).toBeVisible();

  // Hiệu trưởng đặt lại: người dùng bị đăng xuất, đăng nhập bằng mật khẩu mới rồi phải đổi lại
  await page.getByLabel("Tìm theo tên, email, SĐT").fill(phone);
  const row = page.getByRole("row").filter({ hasText: phone });
  await row.getByRole("button", { name: `Thao tác tài khoản ${name}` }).click();
  await page.getByRole("menuitem", { name: "Đặt lại mật khẩu" }).click();
  await page.getByRole("dialog").getByLabel("Mật khẩu mới").fill("Datlai2026");
  await page.getByRole("dialog").getByRole("button", { name: "Đặt mật khẩu" }).click();
  await expect(page.getByText("Đã đặt mật khẩu mới. Hãy báo cho người dùng.")).toBeVisible();
  await expect(row).toContainText("Chờ đổi mật khẩu");

  await user.context().clearCookies();
  await signIn("Datlai2026");
  await expect(user).toHaveURL(/\/doi-mat-khau/);
  await user.close();
});

test("tài khoản hiệu trưởng không có thao tác; phó hiệu trưởng không vào được trang Tài khoản", async ({ page, browser }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/tai-khoan?q=owner%40preschool.local");
  const self = page.getByRole("row").filter({ hasText: ACCOUNTS.owner });
  await expect(self).toContainText("(bạn)");
  await expect(self.getByRole("button", { name: /^Thao tác tài khoản/ })).toHaveCount(0);

  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await expect(principal.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
  await principal.goto("/tai-khoan");
  await expect(principal.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
  await principal.close();
});
