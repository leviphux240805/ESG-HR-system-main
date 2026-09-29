import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("upload file PDF qua presigned URL rồi tải về", async ({ page, request }) => {
  await login(page, ACCOUNTS.teacherA);
  await page.getByRole("link", { name: "Tệp (thử nghiệm)" }).click();

  const name = `hop-dong-${Date.now()}.pdf`;
  await page.getByTestId("file-input").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nfile e2e\n%%EOF"),
  });
  await expect(page.getByText(name)).toBeVisible();

  // Link ký trỏ thẳng tới MinIO (mở tab mới, trình duyệt tải file theo Content-Disposition)
  const signed = page.context().waitForEvent("request", (r) => r.url().includes("X-Amz-Signature"));
  await page.getByRole("button", { name: `Tải về ${name}` }).click();
  const response = await request.get((await signed).url());
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("file e2e");
  expect(response.headers()["content-disposition"]).toContain("attachment");
});

test("file sai loại bị chặn ngay trên giao diện", async ({ page }) => {
  await login(page, ACCOUNTS.teacherA);
  await page.goto("/files-demo");
  await page.getByTestId("file-input").setInputFiles({
    name: "virus.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("MZ"),
  });
  await expect(page.getByText(/loại file không được hỗ trợ/)).toBeVisible();
});
