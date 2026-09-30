import { expect, test } from "@playwright/test";
import { clearPendingChangeRequests, login, publishDocument, randomDigits } from "./helpers";

// Seed dev: tài khoản 0900000005 (giáo viên Cơ sở A) gắn hồ sơ nhân viên; 0900000004 hiệu trưởng A; 0900000003 kế toán A.

test.beforeEach(async ({ request }) => {
  await clearPendingChangeRequests(request);
});

test("giáo viên đề xuất đổi địa chỉ, hiệu trưởng duyệt, hồ sơ cập nhật", async ({ page, browser }) => {
  const address = `Số ${randomDigits(3)} ngõ Kiểm Thử`;
  await login(page, "0900000005");
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Hồ sơ của tôi" }).click();
  await expect(page.getByRole("heading", { name: "Hồ sơ của tôi" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Thông tin cá nhân" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Lịch sử" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sửa thông tin" })).toHaveCount(0);

  await page.getByRole("button", { name: "Đổi SĐT, địa chỉ" }).click();
  await page.getByRole("dialog").getByLabel("Số nhà, đường").first().fill(address);
  await page.getByRole("dialog").getByRole("button", { name: "Gửi đề xuất" }).click();
  await expect(page.getByText("Đã gửi đề xuất, vui lòng chờ duyệt.")).toBeVisible();
  const mine = page.getByRole("list", { name: "Đề xuất cập nhật của tôi" }).getByRole("listitem").filter({ hasText: address }).first();
  await expect(mine).toContainText("Chờ duyệt");

  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await principal.goto("/nhan-su");
  await principal.getByRole("link", { name: "Đề xuất cập nhật" }).click();
  const row = principal.getByRole("row").filter({ hasText: address });
  await expect(row).toContainText("Liên hệ");
  await row.getByRole("button", { name: /^Duyệt đề xuất/ }).click();
  await principal.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click();
  await expect(principal.getByText("Đã duyệt, hồ sơ đã được cập nhật.")).toBeVisible();
  await expect(row).toHaveCount(0);
  await principal.close();

  await page.reload();
  await expect(mine).toContainText("Đã duyệt");
  await expect(page.getByRole("definition").filter({ hasText: address })).toBeVisible();
});

test("đề xuất đổi ngân hàng: hiệu trưởng không thấy, kế toán từ chối kèm lý do", async ({ page, browser }) => {
  const account = randomDigits(10);
  await login(page, "0900000005");
  await page.goto("/cua-toi/ho-so");
  await page.getByRole("button", { name: "Đổi tài khoản ngân hàng" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Ngân hàng").click();
  await page.getByRole("option").first().click();
  await sheet.getByLabel("Số tài khoản").fill(account);
  await sheet.getByRole("button", { name: "Gửi đề xuất" }).click();
  await expect(page.getByText("Đã gửi đề xuất, vui lòng chờ duyệt.")).toBeVisible();

  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await principal.goto("/nhan-su/de-xuat");
  await expect(principal.getByRole("heading", { name: "Đề xuất cập nhật hồ sơ" })).toBeVisible();
  await expect(principal.getByText(account)).toHaveCount(0);
  await principal.close();

  const accountant = await browser.newPage();
  await login(accountant, "0900000003");
  await accountant.goto("/nhan-su/de-xuat");
  const row = accountant.getByRole("row").filter({ hasText: account });
  await expect(row).toContainText("Tài khoản ngân hàng");
  await row.getByRole("button", { name: /^Từ chối đề xuất/ }).click();
  await accountant.getByRole("dialog").getByLabel("Lý do").fill("Tên chủ tài khoản không khớp");
  await accountant.getByRole("dialog").getByRole("button", { name: "Từ chối" }).click();
  await expect(accountant.getByText("Đã từ chối đề xuất.")).toBeVisible();
  await accountant.close();

  await page.reload();
  const mine = page.getByRole("list", { name: "Đề xuất cập nhật của tôi" }).getByRole("listitem").filter({ hasText: account }).first();
  await expect(mine).toContainText("Từ chối");
  await expect(mine).toContainText("Tên chủ tài khoản không khớp");
});

test("văn bản cần đọc: giáo viên thấy ở Của tôi, đọc xong chuyển sang Đã đọc", async ({ page, browser }) => {
  const title = `Thông báo họp ${randomDigits(5)}`;
  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await publishDocument(principal, title, { requireAck: true });
  await principal.close();

  await login(page, "0900000005");
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Văn bản cần đọc" }).click();
  await page.getByRole("list", { name: "Văn bản chưa đọc" }).getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Tôi đã đọc" }).click();
  await expect(page.getByText(/Bạn đã xác nhận đọc lúc/)).toBeVisible();
  await page.goto("/cua-toi/van-ban");
  await expect(page.getByRole("list", { name: "Văn bản đã đọc" })).toContainText(title);
});

test("tài khoản chưa gắn hồ sơ nhân viên thấy hướng dẫn", async ({ page }) => {
  await login(page, "owner@preschool.local");
  await page.goto("/cua-toi/ho-so");
  await expect(page.getByText("Tài khoản chưa gắn hồ sơ nhân viên")).toBeVisible();
});
