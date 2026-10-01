import { expect, test } from "@playwright/test";
import { SCHOOL_A, apiAs, login } from "./helpers";

const ACCOUNTANT_A = "0900000003";
const MONTH = "2026-09";

test("kế toán sinh, phát hành phiếu rồi thu tiền hai lần đến khi đủ", async ({ page, request }) => {
  const api = await apiAs(request, ACCOUNTANT_A, SCHOOL_A);
  await api.post("/api/v1/invoices/generate", { month: `${MONTH}-01` });
  await api.post("/api/v1/invoices/issue", { month: `${MONTH}-01` });
  const list = await api.get<{ items: { invoiceNo: string; childName: string; balance: number }[] }>(
    `/api/v1/invoices?month=${MONTH}-01&status=ISSUED&size=100`,
  );
  const target = list.items.find((r) => r.balance >= 2);
  expect(target, "cần một phiếu chưa thu").toBeTruthy();

  await login(page, ACCOUNTANT_A);
  await page.goto(`/hoc-phi/phieu-thu?month=${MONTH}&q=${encodeURIComponent(target!.invoiceNo)}`);
  await page.getByRole("button", { name: new RegExp(target!.childName) }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(`Phiếu thu ${target!.invoiceNo}`)).toBeVisible();

  await sheet.getByLabel("Số tiền (₫)").fill(String(Math.floor(target!.balance / 2)));
  await sheet.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(sheet.getByText("Thu một phần")).toBeVisible();

  await sheet.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(sheet.getByText("Đã thu đủ")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Ghi nhận" })).toHaveCount(0);
});
