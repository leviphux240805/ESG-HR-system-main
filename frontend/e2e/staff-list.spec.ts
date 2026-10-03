import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

// Dữ liệu seed dev: Cơ sở A có "Nguyễn Thị Lan" (hợp đồng hết hạn sau 20 ngày), Cơ sở B có "Phạm Thị Hoa".

test("hiệu trưởng xem nhân sự mọi trường của mình, lọc và xuất Excel", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Nhân sự" }).click();
  await expect(page.getByRole("heading", { name: "Nhân sự" })).toBeVisible();
  await expect(page.getByText("Nhân sự đang làm")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nguyễn Thị Lan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Phạm Thị Hoa" })).toBeVisible();

  // Tìm kiếm ghi lên URL, bảng lọc theo server
  await page.getByLabel("Tìm theo tên, mã NV, số điện thoại").fill("Hoa");
  await expect(page).toHaveURL(/q=Hoa/);
  await expect(page.getByRole("link", { name: "Phạm Thị Hoa" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nguyễn Thị Lan" })).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
});

test("phó hiệu trưởng trường A chỉ thấy nhân viên trường A", async ({ page }) => {
  await login(page, "0900000004");
  await page.goto("/nhan-su");
  await expect(page.getByRole("link", { name: "Nguyễn Thị Lan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Phạm Thị Hoa" })).toHaveCount(0);
  // Không có bộ lọc cơ sở với vai trò cấp cơ sở
  await expect(page.getByLabel("Cơ sở", { exact: true })).toHaveCount(0);
});

test("giáo viên không có menu Nhân sự và bị chặn khi mở trực tiếp", async ({ page }) => {
  await login(page, ACCOUNTS.teacherA);
  await expect(page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Nhân sự" })).toHaveCount(0);
  await page.goto("/nhan-su");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
});
