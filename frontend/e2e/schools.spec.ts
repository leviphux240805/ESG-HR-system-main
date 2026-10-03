import { expect, test } from "@playwright/test";
import { ACCOUNTS, apiAs, login } from "./helpers";

// Seed dev: 0900000001 hiệu trưởng 3 trường A, B, C (tổ chức 1); 0900000002 hiệu trưởng trường D (tổ chức 2);
// 0900000004 phó hiệu trưởng trường A (Lớp & trẻ, Thực đơn & sức khỏe, Nhân sự, Báo cáo).
const PRINCIPAL_D = "0900000002";
const VICE_A = "0900000004";
const SCHOOL_A = "00000000-0000-0000-0000-00000000000a";

test("hiệu trưởng thấy và sửa được 3 trường của mình", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Trường" }).click();
  await expect(page.getByRole("heading", { name: "Trường", exact: true })).toBeVisible();
  for (const name of ["Trường A – Hoa Sen", "Trường B – Hoa Mai", "Trường C – Hoa Đào"]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Trường D – Sao Mai")).toHaveCount(0);
  // Có thể có thêm trường do E2E "tạo trường" để lại (đã ngừng); 3 trường seed đều sửa được
  await expect(page.getByRole("button", { name: "Sửa" }).nth(2)).toBeVisible();
});

test("hiệu trưởng trường D không thấy trường và dữ liệu của hiệu trưởng khác", async ({ page, request }) => {
  await login(page, PRINCIPAL_D);
  const selector = page.getByLabel("Chọn trường");
  await expect(selector).toContainText("Trường D – Sao Mai");
  await expect(selector).toBeDisabled();
  await page.goto("/truong");
  await expect(page.getByText("Trường D – Sao Mai", { exact: true })).toBeVisible();
  await expect(page.getByText("Trường A – Hoa Sen")).toHaveCount(0);

  const api = await apiAs(request, PRINCIPAL_D);
  const children = await api.get<{ items: { fullName: string }[] }>("/api/v1/children?size=100");
  expect(children.items.map((c) => c.fullName).sort()).toEqual(["Bùi Quang Khải", "Đặng Thu Hà"]);
  const login2 = await request.post("/api/v1/auth/login", { data: { identifier: PRINCIPAL_D, password: "Matkhau@123" } });
  const { accessToken } = await login2.json();
  const foreign = await request.get("/api/v1/children", { headers: { Authorization: `Bearer ${accessToken}`, "X-School-Id": SCHOOL_A } });
  expect(foreign.status()).toBe(403);
});

test("phó hiệu trưởng chỉ thấy menu thuộc nhóm được giao", async ({ page }) => {
  await login(page, VICE_A);
  const menu = page.getByRole("navigation", { name: "Menu chính" });
  await expect(menu.getByRole("link", { name: "Lớp học" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Nhân sự" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Trường" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Phiếu thu" })).toHaveCount(0);
  await page.goto("/truong");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
});
