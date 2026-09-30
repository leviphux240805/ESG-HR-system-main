import { expect, test } from "@playwright/test";
import path from "node:path";
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

// Định nghĩa "xong" (1): import file Excel mẫu → đối soát → khóa tháng
test("import file máy chấm công mẫu, xử lý sai lệch, khóa công, mở khóa có lý do", async ({ page, browser }) => {
  await login(page, "0900000004");
  await page.goto("/cham-cong?month=2026-09");
  await page.getByRole("button", { name: "Import máy chấm công" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("machine-file").setInputFiles(path.resolve("../docs/mau/may-cham-cong-gia-lap-2026-09.xlsx"));
  await expect(dialog.getByTestId("import-preview")).toContainText("999 – Không Có Trong Hệ Thống");
  await dialog.getByRole("button", { name: "Import và đối soát" }).click();
  await expect(dialog.getByTestId("import-result")).toContainText(/Đã đối soát \d+\/\d+ dòng của 6 nhân viên/);
  await expect(dialog.getByTestId("import-result")).toContainText("Bỏ qua 2 dòng của mã chưa gán: 999");
  await dialog.getByRole("button", { name: "Xử lý sai lệch" }).click();

  const review = page.getByRole("dialog");
  await expect(review.getByRole("list", { name: "Ngày sai lệch" }).getByRole("listitem").first()).toBeVisible();
  await review.getByRole("button", { name: "Xác nhận tất cả" }).click();
  await expect(page.getByText(/Đã xác nhận \d+ ngày sai lệch/)).toBeVisible();
  await expect(page.getByTestId("discrepancy-count")).toHaveCount(0);

  // Ô đủ giờ vào/ra được tự điền X
  const grid = page.getByRole("grid", { name: "Bảng công tháng" });
  await expect(grid.getByRole("button", { name: "Hiệu Trưởng A ngày 7/9: X" })).toBeVisible();

  await page.getByRole("button", { name: "Khóa công" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Khóa công" }).click();
  await expect(page.getByText("Đã khóa công", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import máy chấm công" })).toHaveCount(0);
  await grid.getByRole("button", { name: "Hiệu Trưởng A ngày 7/9: X" }).click();
  await expect(page.getByRole("dialog")).toContainText("Công tháng đã khóa, chỉ xem.");
  await page.keyboard.press("Escape");

  // Chỉ văn phòng điều hành mở khóa, bắt buộc lý do
  await expect(page.getByRole("button", { name: "Mở khóa công" })).toHaveCount(0);
  const admin = await browser.newPage();
  await login(admin, "admin@preschool.local");
  await admin.getByLabel("Chọn cơ sở").click();
  await admin.getByRole("option", { name: "Cơ sở A – Hoa Sen" }).click();
  await admin.goto("/cham-cong?month=2026-09");
  await admin.getByRole("button", { name: "Mở khóa công" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Mở khóa" }).click();
  await expect(admin.getByText("Vui lòng ghi lý do mở khóa")).toBeVisible();
  await admin.getByRole("dialog").getByLabel("Lý do mở khóa").fill("Chạy thử e2e");
  await admin.getByRole("dialog").getByRole("button", { name: "Mở khóa" }).click();
  await expect(admin.getByText("Đã mở khóa công tháng.")).toBeVisible();
  await admin.close();
});
