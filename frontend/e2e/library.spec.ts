import { expect, type Page, test } from "@playwright/test";
import { login, randomDigits } from "./helpers";

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });

/** Hiệu trưởng Cơ sở A ban hành văn bản; trả đường dẫn trang chi tiết. */
async function publish(page: Page, title: string, options: { requireAck?: boolean; roles?: string[]; folder?: string } = {}) {
  await page.goto("/tai-lieu");
  await page.getByRole("button", { name: "Ban hành văn bản" }).click();
  const sheet = page.getByRole("dialog");
  if (options.folder) {
    await sheet.getByLabel("Thư mục").click();
    await page.getByRole("option", { name: options.folder }).click();
  }
  await sheet.getByLabel("Tiêu đề").fill(title);
  await sheet.getByLabel("Số hiệu").fill(`${randomDigits(3)}/2026/QĐ`);
  await sheet.getByLabel("Ngày ban hành").fill("2026-09-30");
  for (const role of options.roles ?? []) await sheet.getByRole("checkbox", { name: role }).click();
  if (options.requireAck) await sheet.getByRole("switch", { name: "Yêu cầu xác nhận đã đọc" }).click();
  await sheet.getByTestId("file-input").setInputFiles(pdf("van-ban.pdf"));
  await expect(sheet.getByText("van-ban.pdf")).toBeVisible();
  await sheet.getByRole("button", { name: "Ban hành" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return new URL(page.url()).pathname;
}

// Định nghĩa "xong" phần tài liệu: ban hành cần xác nhận → giáo viên xác nhận → người ban hành thấy tỷ lệ tăng
test("ban hành văn bản cần xác nhận, giáo viên bấm Tôi đã đọc, tỷ lệ đã đọc tăng", async ({ page, browser }) => {
  const title = `Quy định an toàn ${randomDigits(5)}`;
  await login(page, "0900000004"); // hiệu trưởng Cơ sở A
  const path = await publish(page, title, { requireAck: true });
  const rate = page.getByTestId("ack-rate");
  await expect(rate).toContainText(/^0\/\d+ người đã đọc/);
  const total = Number((await rate.textContent())!.match(/\/(\d+)/)![1]);

  const teacher = await browser.newPage();
  await login(teacher, "0900000005"); // giáo viên Cơ sở A
  await teacher.goto("/tai-lieu");
  const row = teacher.getByRole("row").filter({ hasText: title });
  await expect(row).toContainText("Cần xác nhận");
  await row.getByRole("link", { name: title }).click();
  await teacher.getByRole("button", { name: "Tôi đã đọc" }).click();
  await expect(teacher.getByText(/Bạn đã xác nhận đọc lúc/)).toBeVisible();
  // Giáo viên không có nút quản lý
  await expect(teacher.getByRole("button", { name: "Phiên bản mới" })).toHaveCount(0);
  await teacher.close();

  await page.reload();
  await expect(rate).toContainText(`1/${total} người đã đọc`);
  await page.getByRole("tab", { name: /Đã đọc/ }).click();
  await expect(page.getByRole("tabpanel").getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Nhắc người chưa đọc" }).click();
  await expect(page.getByText(/Đã nhắc \d+ người chưa đọc/)).toBeVisible();
  await expect(page.getByText(/Đã nhắc hôm nay lúc/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Nhắc người chưa đọc" })).toBeDisabled();

  // Cơ sở B không thấy văn bản của Cơ sở A
  const staffB = await browser.newPage();
  await login(staffB, "0900000008");
  await staffB.goto(path);
  await expect(staffB.getByText("Không tìm thấy văn bản")).toBeVisible();
  await staffB.close();
});

test("thư mục và phạm vi vai trò: văn bản chỉ cho giáo viên thì y tế không thấy", async ({ page, browser }) => {
  const folder = `Quy chế ${randomDigits(4)}`;
  await login(page, "0900000004");
  await page.goto("/tai-lieu");
  await page.getByRole("button", { name: /^Thư mục mới – Cơ sở A/ }).click();
  await page.getByRole("dialog").getByLabel("Tên thư mục").fill(folder);
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("navigation", { name: "Thư mục văn bản" }).getByRole("button", { name: folder, exact: true })).toBeVisible();

  const title = `Quy trình chăm sóc ${randomDigits(5)}`;
  const path = await publish(page, title, { roles: ["Giáo viên"], folder });
  await expect(page.getByRole("definition").filter({ hasText: folder })).toBeVisible();

  await page.goto("/tai-lieu");
  await page.getByRole("navigation", { name: "Thư mục văn bản" }).getByRole("button", { name: folder, exact: true }).click();
  await expect(page).toHaveURL(/folder=/);
  await expect(page.getByRole("row").filter({ hasText: title })).toContainText("Giáo viên");

  const nurse = await browser.newPage();
  await login(nurse, "0900000006"); // y tế Cơ sở A
  await nurse.goto("/tai-lieu");
  await expect(nurse.getByRole("heading", { name: "Tài liệu" })).toBeVisible();
  await expect(nurse.getByText(title)).toHaveCount(0);
  await expect(nurse.getByRole("button", { name: "Ban hành văn bản" })).toHaveCount(0);
  await nurse.goto(path);
  await expect(nurse.getByText("Không tìm thấy văn bản")).toBeVisible();
  await nurse.close();

  const teacher = await browser.newPage();
  await login(teacher, "0900000005");
  await teacher.goto(path);
  await expect(teacher.getByRole("heading", { name: title })).toBeVisible();
  await teacher.close();
});
