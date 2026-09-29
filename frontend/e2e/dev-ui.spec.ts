import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("trang mẫu /dev/ui hiển thị component và bảng phân trang", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { name: "Thư viện component (dev)" })).toBeVisible();
  await expect(page.getByText("Hiển thị 1–20 / 137")).toBeVisible();

  await page.getByLabel("Tìm theo họ tên").fill("Lan");
  await expect(page.getByText("Hiển thị 1–20 / 137")).toHaveCount(0);
  await expect(page).toHaveURL(/q=Lan/);
});
