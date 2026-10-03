import { expect, test } from "@playwright/test";
import { ACCOUNTS, SCHOOL_A, SEED_PASSWORD, login } from "./helpers";

/** Một tháng ngẫu nhiên 10/2025 – 6/2026 (sau khi Giáo Viên A có cấu hình lương) để các lần chạy không đụng nhau. */
function randomMonth() {
  const d = new Date(2025, 9 + Math.floor(Math.random() * 9), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

test("tính lương từ bảng công đã khóa, thưởng, duyệt; giáo viên xem phiếu lương của mình", async ({ page, browser, request }) => {
  const month = randomMonth();
  const token = (await (await request.post("/api/v1/auth/login", { data: { identifier: ACCOUNTS.owner, password: SEED_PASSWORD } })).json()).accessToken;
  const headers = { Authorization: `Bearer ${token}`, "X-School-Id": SCHOOL_A };
  // Chuẩn bị: khóa công tháng (có thể đã khóa từ lần chạy trước); bảng lương đã duyệt thì mở lại
  await request.post(`/api/v1/attendance/months/${month}/lock`, { headers });
  await request.post(`/api/v1/payroll/periods/${month}/reopen`, { headers, data: { reason: "Chạy lại e2e" } });

  await login(page, ACCOUNTS.owner);
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await page.goto(`/luong?month=${month}`);
  await page.getByRole("button", { name: /^Tính (lương|lại)$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Tính lương" }).click();
  await expect(page.getByText("Đã tính lương.")).toBeVisible();
  const table = page.getByRole("table", { name: "Bảng lương" });
  await table.getByRole("button", { name: "Phiếu lương Giáo Viên A" }).click();

  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Thưởng (đ)").fill("200000");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu, phiếu lương đã tính lại.")).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: "Giáo Viên A" })).toContainText("200.000");

  await page.getByRole("button", { name: "Duyệt" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click();
  await expect(page.getByText("Đã duyệt, nhân viên đã nhận phiếu lương.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Tính (lương|lại)$/ })).toHaveCount(0);

  const teacher = await browser.newPage({ viewport: { width: 360, height: 780 } });
  await login(teacher, ACCOUNTS.teacherA);
  await teacher.goto("/cua-toi/phieu-luong");
  const [y, m] = month.split("-");
  await teacher.getByRole("button", { name: new RegExp(`Tháng ${Number(m)}/${y}`) }).click();
  await expect(teacher.getByText("Thực lĩnh")).toBeVisible();
  await expect(teacher.getByText("Thưởng")).toBeVisible();
  const download = teacher.waitForEvent("download");
  await teacher.getByRole("button", { name: "Tải phiếu lương PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await teacher.close();
});
