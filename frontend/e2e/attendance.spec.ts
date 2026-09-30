import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

// Seed dev: cấu hình chấm công mặc định toàn chuỗi; Nguyễn Thị Lan (Cơ sở A, mã chấm công 105).

test("hiệu trưởng mở bảng công, sửa và xóa mã một ô", async ({ page }) => {
  await login(page, "0900000004");
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Chấm công", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chấm công" })).toBeVisible();

  // Tháng cố định để không đụng dữ liệu import
  await page.goto("/cham-cong?month=2026-08");
  await expect(page.getByTestId("month-label")).toHaveText("Tháng 8/2026");
  const grid = page.getByRole("grid", { name: "Bảng công tháng" });
  const cell = grid.getByRole("button", { name: /^Nguyễn Thị Lan ngày 4\/8:/ });
  await cell.click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Mã công").click();
  await page.getByRole("option", { name: "NB – Nghỉ bù" }).click();
  await sheet.getByLabel("Ghi chú").fill("Bù ngày hội trường");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu chấm công.")).toBeVisible();
  await expect(grid.getByRole("button", { name: "Nguyễn Thị Lan ngày 4/8: NB" })).toBeVisible();

  // Trả lại trạng thái ban đầu để chạy lại được
  await grid.getByRole("button", { name: "Nguyễn Thị Lan ngày 4/8: NB" }).click();
  await page.getByRole("dialog").getByLabel("Mã công").click();
  await page.getByRole("option", { name: "— Chưa chấm —" }).click();
  await page.getByRole("dialog").getByLabel("Ghi chú").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(grid.getByRole("button", { name: "Nguyễn Thị Lan ngày 4/8: chưa chấm" })).toBeVisible();

  // Đổi tháng bằng nút
  await page.getByRole("button", { name: "Tháng sau" }).click();
  await expect(page).toHaveURL(/month=2026-09/);
});

test("giáo viên không có menu Chấm công và bị chặn khi mở trực tiếp", async ({ page }) => {
  await login(page, ACCOUNTS.teacherA);
  await expect(page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Chấm công", exact: true })).toHaveCount(0);
  await page.goto("/cham-cong");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
});

test("chủ chuỗi xem tất cả cơ sở được nhắc chọn một cơ sở", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/cham-cong");
  await expect(page.getByText("Chọn một cơ sở", { exact: true })).toBeVisible();
});
