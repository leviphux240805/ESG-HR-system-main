import { expect, test } from "@playwright/test";
import { createStaffA, login, randomDigits } from "./helpers";

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });

test("hồ sơ nhân viên: sửa thông tin, thêm hợp đồng, giấy tờ nhiều phiên bản, lịch sử", async ({ page, request }) => {
  const name = `Lê Thị Hồ Sơ ${randomDigits(4)}`;
  const staff = await createStaffA(request, name);

  await login(page, "0900000004"); // hiệu trưởng Cơ sở A
  await page.goto(`/nhan-su/${staff.id}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Thông tin cá nhân" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(staff.phone)).toBeVisible();

  // Sửa thông tin ngay trong tab
  const newPhone = "08" + randomDigits(8);
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await page.getByLabel("Số điện thoại").fill(newPhone);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Đã lưu hồ sơ.")).toBeVisible();
  await expect(page.getByText(newPhone)).toBeVisible();

  // Hợp đồng: tab ghi lên URL
  await page.getByRole("tab", { name: "Hợp đồng & quyết định" }).click();
  await expect(page).toHaveURL(/tab=contracts/);
  await expect(page.getByText("Chưa có hợp đồng")).toBeVisible();
  await page.getByRole("button", { name: "Thêm hợp đồng" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Loại hợp đồng").click();
  await page.getByRole("option", { name: "Xác định thời hạn", exact: true }).click();
  await sheet.getByLabel("Số hợp đồng").fill("15/2026/HĐLĐ");
  await sheet.getByLabel("Ngày bắt đầu").fill("2026-09-01");
  await sheet.getByLabel("Ngày kết thúc").fill("2027-08-31");
  await sheet.getByTestId("file-input").setInputFiles(pdf("hop-dong.pdf"));
  await expect(sheet.getByText("hop-dong.pdf")).toBeVisible();
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm hợp đồng.")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "15/2026/HĐLĐ" });
  await expect(row).toContainText("Đang hiệu lực");
  await expect(row).toContainText("31/08/2027");

  // Xem trước PDF trong hộp thoại
  await row.getByRole("button", { name: "hop-dong.pdf" }).click();
  const preview = page.getByRole("dialog", { name: "hop-dong.pdf" });
  await expect(preview.locator("iframe")).toBeVisible();
  await page.keyboard.press("Escape");

  // Giấy tờ: tải lên rồi tải phiên bản mới, bản cũ vẫn giữ
  await page.getByRole("tab", { name: "Giấy tờ" }).click();
  const health = page.getByTestId("doc-type-GIAY_KHAM_SUC_KHOE");
  await expect(health).toContainText("Chưa có");
  await health.getByRole("button", { name: "Tải lên" }).click();
  const upload = page.getByRole("dialog");
  await upload.getByTestId("file-input").setInputFiles(pdf("kham-2025.pdf"));
  await expect(upload.getByText("kham-2025.pdf")).toBeVisible();
  await upload.getByLabel("Ngày hết hạn").fill("2026-10-10");
  await upload.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(health).toContainText("kham-2025.pdf");
  await expect(health).toContainText(/Còn \d+ ngày|Đã hết hạn|Hết hạn 10\/10\/2026/);

  await health.getByRole("button", { name: "Phiên bản mới" }).click();
  await upload.getByTestId("file-input").setInputFiles(pdf("kham-2026.pdf"));
  await expect(upload.getByText("kham-2026.pdf")).toBeVisible();
  await upload.getByRole("button", { name: "Tải lên", exact: true }).click();
  await expect(health).toContainText("kham-2026.pdf");
  await health.getByRole("button", { name: "2 phiên bản" }).click();
  await expect(health).toContainText("kham-2025.pdf");

  // Lịch sử: quá trình công tác và nhật ký
  await page.getByRole("tab", { name: "Lịch sử" }).click();
  await expect(page.getByRole("list", { name: "Quá trình công tác" })).toContainText("Hiện tại");
  const log = page.getByRole("list", { name: "Nhật ký thay đổi" });
  await expect(log).toContainText("Tạo hồ sơ");
  await expect(log).toContainText(`Số điện thoại: ${staff.phone} → ${newPhone}`);
  await expect(log).toContainText("Thêm hợp đồng");
  await expect(log).toContainText("Giấy khám sức khỏe");
});

test("mở hồ sơ bằng liên kết có ?tab=, hồ sơ cơ sở khác báo không tìm thấy", async ({ page }) => {
  await login(page, "0900000004");
  // Nguyễn Thị Lan (Cơ sở A, seed) — mở thẳng tab hợp đồng
  await page.goto("/nhan-su/00000000-0000-0000-0000-000000000105?tab=contracts");
  await expect(page.getByRole("tab", { name: "Hợp đồng & quyết định" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Hợp đồng lao động")).toBeVisible();

  // Phạm Thị Hoa thuộc Cơ sở B: hiệu trưởng A không xem được
  await page.goto("/nhan-su/00000000-0000-0000-0000-000000000113");
  await expect(page.getByText("Không tìm thấy hồ sơ")).toBeVisible();
});

test("từ danh sách bấm tên mở hồ sơ", async ({ page }) => {
  await login(page, "0900000004");
  await page.goto("/nhan-su");
  await page.getByRole("link", { name: "Nguyễn Thị Lan" }).click();
  await expect(page).toHaveURL(/\/nhan-su\/00000000-0000-0000-0000-000000000105$/);
  await expect(page.getByRole("heading", { name: "Nguyễn Thị Lan" })).toBeVisible();
});

test("bảo hiểm & thuế, trình độ: người phụ thuộc, mã số thuế, chứng chỉ có hạn", async ({ page, request }) => {
  const staff = await createStaffA(request, `Hà Thị Chứng Chỉ ${randomDigits(4)}`);
  await login(page, "0900000004");

  await page.goto(`/nhan-su/${staff.id}?tab=insurance`);
  await page.getByRole("button", { name: "Sửa" }).click();
  let sheet = page.getByRole("dialog");
  await sheet.getByLabel("Mã số thuế cá nhân").fill("8012345678");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("definition").filter({ hasText: "8012345678" })).toBeVisible();

  await page.getByRole("button", { name: "Thêm người phụ thuộc" }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Họ và tên").fill("Nguyễn Minh An");
  await sheet.getByLabel("Quan hệ").fill("Con");
  await sheet.getByLabel("Giảm trừ từ tháng").fill("2026-01");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Nguyễn Minh An" })).toContainText("Tháng 1/2026 – nay");

  await page.getByRole("tab", { name: "Trình độ" }).click();
  await expect(page).toHaveURL(/tab=qualifications/);
  await page.getByRole("button", { name: "Thêm chứng chỉ" }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Tên chứng chỉ").fill("Sơ cấp cứu trẻ em");
  await sheet.getByLabel("Ngày cấp").fill("2024-10-01");
  await sheet.getByLabel("Ngày hết hạn").fill("2025-10-01");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Sơ cấp cứu trẻ em" })).toContainText("Đã hết hạn");
});
