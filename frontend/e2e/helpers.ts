import { type APIRequestContext, expect, type Locator, type Page } from "@playwright/test";

/** Mật khẩu chung của tài khoản seed dev (backend/src/main/resources/db/dev/R__dev_seed.sql). */
export const SEED_PASSWORD = "Matkhau@123";

export const ACCOUNTS = {
  owner: "owner@preschool.local",
  teacherA: "0900000005",
  staffB: "0900000008",
} as const;

export async function login(page: Page, identifier: string, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Email hoặc số điện thoại").fill(identifier);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByLabel("Chọn trường")).toBeVisible();
}

export const SCHOOL_A = "00000000-0000-0000-0000-00000000000a";

export const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

/** Gọi API trực tiếp (qua proxy của Vite) để chuẩn bị dữ liệu cho test, không đi qua giao diện. */
export async function apiAs(request: APIRequestContext, identifier: string, schoolId?: string) {
  const login = await request.post("/api/v1/auth/login", { data: { identifier, password: SEED_PASSWORD } });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = await login.json();
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (schoolId) headers["X-School-Id"] = schoolId;
  return {
    async get<T = Record<string, unknown>>(path: string): Promise<T> {
      const res = await request.get(path, { headers });
      expect(res.ok(), await res.text()).toBeTruthy();
      return res.json();
    },
    async post<T = Record<string, unknown>>(path: string, data: unknown): Promise<T> {
      const res = await request.post(path, { data, headers });
      expect(res.ok(), await res.text()).toBeTruthy();
      return res.json();
    },
    async patch<T = Record<string, unknown>>(path: string, data: unknown): Promise<T> {
      const res = await request.patch(path, { data, headers });
      expect(res.ok(), await res.text()).toBeTruthy();
      return res.json();
    },
  };
}

/** Tạo nhân viên mới (dữ liệu riêng mỗi lần chạy) ở Cơ sở A. */
export async function createStaffA(request: APIRequestContext, fullName: string) {
  const api = await apiAs(request, "0900000004", SCHOOL_A);
  return api.post<{ id: string; staffCode: string; fullName: string; phone: string }>("/api/v1/staff", {
    schoolId: SCHOOL_A,
    fields: { fullName, phone: "07" + randomDigits(8), position: "TEACHER", startDate: "2026-09-01" },
  });
}

/** Từ chối mọi đề xuất cập nhật đang chờ (dọn dữ liệu của lần chạy trước bị dừng giữa chừng). */
export async function clearPendingChangeRequests(request: APIRequestContext) {
  const admin = await apiAs(request, ACCOUNTS.owner);
  const page = await admin.get<{ items: { id: string }[] }>("/api/v1/staff/change-requests?status=PENDING&size=100");
  for (const item of page.items) {
    await admin.post(`/api/v1/staff/change-requests/${item.id}/reject`, { note: "Dọn dữ liệu e2e" });
  }
}

export const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });

/** Hiệu trưởng Cơ sở A ban hành văn bản; trả đường dẫn trang chi tiết. */
export async function publishDocument(page: Page, title: string, options: { requireAck?: boolean; roles?: string[]; folder?: string } = {}) {
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

/** Lưới tháng ảo hóa hàng: cuộn dần cho tới khi ô cần tìm được vẽ (dữ liệu dev có thể nhiều nhân viên). */
export async function gridCell(grid: Locator, name: string): Promise<Locator> {
  const cell = grid.getByRole("button", { name });
  await expect(grid).toBeVisible();
  await grid.evaluate((el) => el.scrollTo(0, 0));
  for (let i = 0; i < 60 && (await cell.count()) === 0; i++) {
    const atEnd = await grid.evaluate((el) => {
      el.scrollBy(0, el.clientHeight * 0.8);
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    });
    if (atEnd && (await cell.count()) === 0) await grid.page().waitForTimeout(100);
  }
  return cell;
}

