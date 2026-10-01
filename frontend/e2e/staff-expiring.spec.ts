import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

// Seed dev: Nguyễn Thị Lan (Cơ sở A) hợp đồng hết hạn sau 20 ngày; Phạm Thị Hoa (Cơ sở B) sau 75 ngày.

test("hiệu trưởng xem giấy tờ sắp hết hạn của cơ sở mình, bấm mở đúng tab hồ sơ", async ({ page }) => {
  await login(page, "0900000004");
  await page.goto("/nhan-su");
  await page.getByRole("link", { name: /Xem giấy tờ sắp hết hạn/ }).click();
  await expect(page.getByRole("heading", { name: "Giấy tờ sắp hết hạn" })).toBeVisible();

  const lan = page.getByRole("row").filter({ hasText: "Nguyễn Thị Lan" }).filter({ hasText: "Hợp đồng" });
  await expect(lan).toContainText("Còn 20 ngày");
  // Cơ sở B không nằm trong phạm vi, kể cả khi mở rộng 90 ngày
  await page.getByRole("radio", { name: "90 ngày tới" }).click();
  await expect(page).toHaveURL(/within=90/);
  await expect(page.getByText("Phạm Thị Hoa")).toHaveCount(0);

  await lan.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/nhan-su\/00000000-0000-0000-0000-000000000105\?tab=contracts/);
  await expect(page.getByRole("tab", { name: "Hợp đồng & quyết định" })).toHaveAttribute("aria-selected", "true");
});

test("chủ chuỗi: 30 ngày chưa thấy hợp đồng 75 ngày, 90 ngày thì thấy; lọc theo loại", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/nhan-su/giay-to-het-han");
  const hoa = page.getByRole("row").filter({ hasText: "Phạm Thị Hoa" }).filter({ hasText: "Hợp đồng" });
  await expect(page.getByRole("row").filter({ hasText: "Nguyễn Thị Lan" }).first()).toBeVisible();
  await expect(hoa).toHaveCount(0);

  await page.getByRole("radio", { name: "90 ngày tới" }).click();
  await expect(hoa).toContainText("Trường B – Hoa Mai");

  await page.getByLabel("Loại").click();
  await page.getByRole("option", { name: "Chứng chỉ" }).click();
  await expect(page).toHaveURL(/kind=CERTIFICATE/);
  await expect(hoa).toHaveCount(0);
});

test("chuông thông báo mở danh sách", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.getByRole("button", { name: /^Thông báo/ }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Thông báo", { exact: true })).toBeVisible();
  await expect(panel.getByRole("list", { name: "Danh sách thông báo" }).or(panel.getByText("Chưa có thông báo nào."))).toBeVisible();
});
