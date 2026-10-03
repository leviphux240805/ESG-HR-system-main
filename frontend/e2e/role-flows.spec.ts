import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, SCHOOL_A, apiAs, login, pdf, randomDigits } from "./helpers";

// Kiểm thử trước bàn giao (docs/kiem-thu.md): mỗi vai trò một luồng chính, chế độ API thật, dữ liệu seed dev.
const VICE_A = "0900000004";
const ACCOUNTANT_A = "0900000003";

async function chooseSchool(page: Page, name: string) {
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name }).click();
  await expect(page.getByLabel("Chọn trường")).toContainText(name);
}

// Trường do luồng hiệu trưởng tạo luôn được ngừng (kể cả khi test dừng giữa chừng) để header các test khác không đổi
test.afterEach(async ({ request }) => {
  const owner = await apiAs(request, ACCOUNTS.owner, SCHOOL_A);
  const schools = await owner.get<{ id: string; name: string; active: boolean }[]>("/api/v1/schools");
  for (const s of schools.filter((x) => x.active && x.name.startsWith("Trường Kiểm Thử "))) {
    await owner.post(`/api/v1/schools/${s.id}/deactivate`, {});
  }
});

/** Thứ Hai ngẫu nhiên ở năm xa để đơn nghỉ không trùng lần chạy trước, không vướng tháng đã khóa công. */
function randomMonday() {
  const d = new Date(Date.UTC(2031 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), 4));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split("-");
  return { iso, display: `${day}/${m}/${y}` };
}

test("hiệu trưởng: tạo trường → thêm nhân sự → duyệt đơn nghỉ → xem báo cáo", async ({ page, request }) => {
  const suffix = randomDigits(5);
  const schoolName = `Trường Kiểm Thử ${suffix}`;
  await login(page, ACCOUNTS.owner);

  // 1. Tạo trường
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Trường" }).click();
  await page.getByRole("button", { name: "Thêm trường" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Mã trường").fill(`KT${suffix}`);
  await sheet.getByLabel("Tên trường").fill(schoolName);
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu.")).toBeVisible();
  await expect(page.getByText(schoolName, { exact: true })).toBeVisible();

  // 2. Thêm nhân viên vào trường mới
  await chooseSchool(page, schoolName);
  await page.goto("/nhan-su/moi");
  await page.getByLabel("Họ và tên").fill(`Lê Thị Mới ${suffix}`);
  await page.getByLabel("Số điện thoại").fill("08" + randomDigits(8));
  await page.getByLabel("Vị trí").click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();
  await expect(page.getByText(new RegExp(`Đã thêm nhân viên Lê Thị Mới ${suffix}`))).toBeVisible();
  await expect(page.getByRole("heading", { name: `Lê Thị Mới ${suffix}` })).toBeVisible();
  await page.goto("/nhan-su");
  await expect(page.getByRole("link", { name: `Lê Thị Mới ${suffix}` }).first()).toBeVisible();

  // 3. Duyệt đơn nghỉ của giáo viên Trường A
  const day = randomMonday();
  const teacher = await apiAs(request, ACCOUNTS.teacherA, SCHOOL_A);
  await teacher.post("/api/v1/me/leave-requests", { leaveCode: "P", fromDate: day.iso, toDate: day.iso, halfDay: false, reason: "Kiểm thử bàn giao" });
  await chooseSchool(page, "Trường A – Hoa Sen");
  await page.goto("/nghi-phep?tab=cho-duyet");
  await page.getByRole("button", { name: `Duyệt đơn của Giáo Viên A ${day.display}` }).click();
  await expect(page.getByText("Đã duyệt đơn, bảng công đã cập nhật.")).toBeVisible();

  // 4. Báo cáo: số liệu và xuất Excel
  await page.getByRole("navigation", { name: "Menu chính" }).getByRole("link", { name: "Báo cáo" }).click();
  await expect(page.getByRole("heading", { name: "Báo cáo", exact: true })).toBeVisible();
  await expect(page.getByText("Tỷ lệ đi học các ngày gần đây (%)")).toBeVisible();
  await expect(page.getByText("Thu chi 6 tháng")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Danh sách trẻ" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

  // Dọn: ngừng trường vừa tạo để danh sách trường của seed không phình
  await page.goto("/truong");
  const card = page.locator("div").filter({ hasText: schoolName }).filter({ has: page.getByRole("button", { name: "Ngừng hoạt động" }) }).last();
  await card.getByRole("button", { name: "Ngừng hoạt động" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Ngừng hoạt động" }).click();
  await expect(page.getByText("Đã ngừng trường.")).toBeVisible();
});

test("phó hiệu trưởng: chỉ thấy nhóm được giao, quản lý lớp/nhân sự, báo cáo không có tài chính", async ({ page }) => {
  await login(page, VICE_A);
  const menu = page.getByRole("navigation", { name: "Menu chính" });
  for (const name of ["Lớp học", "Hồ sơ trẻ", "Nhân sự", "Chấm công", "Thực đơn tuần", "Báo cáo"]) {
    await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
  }
  for (const name of ["Phiếu thu", "Công nợ", "Bảng lương", "Trường", "Tài khoản"]) {
    await expect(menu.getByRole("link", { name, exact: true })).toHaveCount(0);
  }

  await menu.getByRole("link", { name: "Hồ sơ trẻ" }).click();
  await expect(page.getByRole("button", { name: "Thêm trẻ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nguyễn Minh An" }).first()).toBeVisible();

  await menu.getByRole("link", { name: "Nhân sự" }).click();
  await expect(page.getByRole("link", { name: "Thêm nhân viên" })).toBeVisible();

  await menu.getByRole("link", { name: "Báo cáo" }).click();
  await expect(page.getByText("Tỷ lệ đi học các ngày gần đây (%)")).toBeVisible();
  await expect(page.getByText("Thu chi 6 tháng")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bảng lương" })).toHaveCount(0);

  await page.goto("/hoc-phi/phieu-thu");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập trang này" })).toBeVisible();
});

test("giáo viên trên điện thoại 375px: điểm danh lớp, nhận việc có file đính kèm", async ({ browser, request }) => {
  const title = `Chuẩn bị góc học tập ${randomDigits(5)}`;
  const owner = await apiAs(request, ACCOUNTS.owner, SCHOOL_A);
  const task = await owner.post<{ id: string }>("/api/v1/tasks", {
    schoolId: SCHOOL_A,
    title,
    priority: "HIGH",
    dueAt: "2027-12-31T10:00:00Z",
    assigneeStaffIds: ["00000000-0000-0000-0000-000000000102"],
  });
  const fileId = await owner.upload(pdf("huong-dan.pdf"));
  await owner.post(`/api/v1/tasks/${task.id}/attachments`, { fileId });

  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await phone.newPage();
  await login(page, ACCOUNTS.teacherA);

  // Điểm danh: đánh dấu cả lớp có mặt, một bé vắng có phép
  await page.goto("/diem-danh");
  const roll = page.getByRole("radiogroup", { name: "Điểm danh Lê Gia Huy" });
  await expect(roll).toBeVisible();
  for (const name of ["Nguyễn Minh An", "Trần Bảo Ngọc"]) {
    await page.getByRole("radiogroup", { name: `Điểm danh ${name}` }).getByRole("radio", { name: "Có mặt" }).click();
  }
  await roll.getByRole("radio", { name: "Có phép" }).click();
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await expect(page.getByText("Đã lưu điểm danh.")).toBeVisible();
  // Không cuộn ngang ở 375px
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  // Việc được giao: mở, thấy file, chuyển "Đang làm"
  await page.goto("/cong-viec");
  await page.getByRole("tab", { name: /^Mới/ }).click();
  await page.getByRole("button", { name: new RegExp(title) }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("huong-dan.pdf")).toBeVisible();
  await sheet.getByRole("button", { name: "Đang làm" }).click();
  await expect(page.getByText('Đã chuyển sang "Đang làm".')).toBeVisible();
  await phone.close();
});

test("kế toán: phiếu thu tháng, thu tiền, xem công nợ", async ({ page, request }) => {
  // Trẻ mới ở lớp Nhà trẻ 1 (không đụng lớp của giáo viên A) để mỗi lần chạy có một phiếu còn nợ
  const childName = `Trẻ Kế Toán ${randomDigits(5)}`;
  const month = "2026-10";
  const owner = await apiAs(request, ACCOUNTS.owner, SCHOOL_A);
  await owner.post("/api/v1/children", {
    profile: { fullName: childName, dob: "2023-01-10", gender: "FEMALE" },
    enrolledAt: "2026-09-05",
    classId: "00000000-0000-0000-0000-000000000702",
  });
  const api = await apiAs(request, ACCOUNTANT_A, SCHOOL_A);
  await api.post("/api/v1/invoices/generate", { month: `${month}-01` });
  await api.post("/api/v1/invoices/issue", { month: `${month}-01` });
  const list = await api.get<{ items: { invoiceNo: string; childName: string; balance: number }[] }>(
    `/api/v1/invoices?month=${month}-01&q=${encodeURIComponent(childName)}&size=10`,
  );
  const target = list.items[0];
  expect(target?.balance, "phiếu của trẻ mới phải còn nợ").toBeGreaterThan(0);

  await login(page, ACCOUNTANT_A);
  const menu = page.getByRole("navigation", { name: "Menu chính" });
  await expect(menu.getByRole("link", { name: "Hồ sơ trẻ" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Tài khoản" })).toHaveCount(0);

  await menu.getByRole("link", { name: "Công nợ" }).click();
  await expect(page.getByRole("heading", { name: "Công nợ" })).toBeVisible();
  await page.getByLabel(/^Tìm/).first().fill(childName);
  await expect(page.getByRole("row").filter({ hasText: childName })).toBeVisible();

  await page.goto(`/hoc-phi/phieu-thu?month=${month}&q=${encodeURIComponent(target.invoiceNo)}`);
  await page.getByRole("button", { name: new RegExp(childName) }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(`Phiếu thu ${target.invoiceNo}`)).toBeVisible();
  await sheet.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(sheet.getByText("Đã thu đủ")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(`/hoc-phi/cong-no?q=${encodeURIComponent(childName)}`);
  await expect(page.getByRole("heading", { name: "Công nợ" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: childName })).toHaveCount(0);
});
