import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { login } from "./helpers";

const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

test("thêm nhân viên bằng quét mã QR CCCD", async ({ page }) => {
  const citizenId = randomDigits(12);
  const phone = "07" + randomDigits(8);
  const qr = await QRCode.toBuffer(`${citizenId}||TRẦN THỊ KIỂM THỬ|05031996|Nữ|Số 9, Phường Cũ, Quận Cũ, Hà Nội|20102022`, {
    width: 480,
  });

  await login(page, "0900000004"); // hiệu trưởng Cơ sở A
  await page.goto("/nhan-su");
  await page.getByRole("link", { name: "Thêm nhân viên" }).click();
  await expect(page.getByRole("heading", { name: "Thêm nhân viên" })).toBeVisible();

  await page.getByRole("button", { name: "Quét CCCD" }).click();
  await page.getByTestId("cccd-front").setInputFiles({ name: "mat-truoc.png", mimeType: "image/png", buffer: qr });
  await expect(page.getByTestId("cccd-info")).toContainText(citizenId);
  await expect(page.getByTestId("cccd-info")).toContainText("Trần Thị Kiểm Thử");
  await page.getByRole("button", { name: "Dùng thông tin này" }).click();

  // Thông tin được điền sẵn từ QR
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Trần Thị Kiểm Thử");
  await expect(page.getByLabel("Số CCCD")).toHaveValue(citizenId);
  await expect(page.getByLabel("Ngày sinh")).toHaveValue("1996-03-05");
  await expect(page.getByLabel("Số nhà, đường").first()).toHaveValue(/Số 9/);

  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Vị trí").click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();

  await expect(page.getByText(/Đã thêm nhân viên Trần Thị Kiểm Thử \(NV\d+\)/)).toBeVisible();
  // SĐT duy nhất mỗi lần chạy: chờ tìm kiếm áp dụng rồi mới kiểm tra
  await page.getByLabel("Tìm theo tên, mã NV, số điện thoại").fill(phone);
  await expect(page).toHaveURL(new RegExp(`q=${phone}`));
  const row = page.getByRole("row").filter({ hasText: phone });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Trần Thị Kiểm Thử");
});

test("trùng CCCD với hồ sơ cơ sở khác được báo dưới ô nhập", async ({ page }) => {
  await login(page, "0900000004");
  await page.goto("/nhan-su/moi");
  // 001197000113 là CCCD của Phạm Thị Hoa (Cơ sở B) trong seed
  await page.getByLabel("Số CCCD").fill("001197000113");
  await page.getByLabel("Họ và tên").click();
  await expect(page.getByText("số CCCD đã có trong hồ sơ nhân viên khác")).toBeVisible();
});
