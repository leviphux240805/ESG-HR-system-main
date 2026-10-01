import { expect, test } from "@playwright/test";
import { ACCOUNTS, SCHOOL_A, apiAs, login, randomDigits } from "./helpers";

// Seed dev: Trường A có lớp Chồi 1 (giáo viên 0900000005) và Nhà trẻ 1; hiệu trưởng owner@ quản lý A, B, C.

/** Một ngày thứ Ba ngẫu nhiên năm 2027 để đơn nghỉ không trùng giữa các lần chạy. */
function randomTuesday() {
  const d = new Date(Date.UTC(2027, 0, 5 + 7 * Math.floor(Math.random() * 40)));
  return d.toISOString().slice(0, 10);
}

test("hiệu trưởng xem Hôm nay và Lớp học của trường A", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await page.goto("/hom-nay");
  await expect(page.getByRole("heading", { name: "Hôm nay", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sĩ số theo lớp" })).toBeVisible();
  await expect(page.getByText("Chồi 1", { exact: true }).first()).toBeVisible();

  await page.goto("/lop-hoc");
  await expect(page.getByText("Chồi 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Giáo Viên A").first()).toBeVisible();
});

test("thêm trẻ rồi mở hồ sơ", async ({ page }) => {
  const name = `Trẻ Thử ${randomDigits(4)}`;
  await login(page, ACCOUNTS.owner);
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await page.goto("/tre");
  await page.getByRole("button", { name: "Thêm trẻ" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Họ và tên").fill(name);
  await sheet.getByLabel("Ngày sinh").fill("2022-04-10");
  await sheet.getByLabel("Lớp").click();
  await page.getByRole("option", { name: "Chồi 1" }).click();
  await sheet.getByLabel(/^Phụ huynh/).fill("Trần Thị Mẹ");
  await sheet.getByLabel("Số điện thoại").fill("0912345678");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm trẻ.")).toBeVisible();

  await page.getByLabel("Tìm theo tên, tên gọi, mã").fill(name);
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Trần Thị Mẹ")).toBeVisible();
});

test("giáo viên điểm danh lớp mình trên điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await login(page, ACCOUNTS.teacherA);
  await page.goto("/diem-danh");
  const roll = page.getByRole("radiogroup", { name: "Điểm danh Nguyễn Minh An" });
  await expect(roll).toBeVisible();
  await roll.getByRole("radio", { name: "Có phép" }).click();
  await page.getByLabel("Ghi chú Nguyễn Minh An").fill("Bé ốm");
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await expect(page.getByText("Đã lưu điểm danh.")).toBeVisible();
  await page.reload();
  await expect(roll.getByRole("radio", { name: "Có phép" })).toHaveAttribute("aria-checked", "true");
});

test("giao việc, người nhận gửi duyệt, hiệu trưởng duyệt trong Hộp duyệt", async ({ page, request }) => {
  const title = `Việc thử ${randomDigits(5)}`;
  await login(page, ACCOUNTS.owner);
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await page.goto("/cong-viec");
  await page.getByRole("button", { name: "Giao việc" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Tên việc").fill(title);
  await sheet.getByLabel("Hạn").fill("2027-12-31");
  await sheet.getByText("Giáo Viên A").click();
  await sheet.getByRole("button", { name: "Giao việc" }).click();
  await expect(page.getByText("Đã giao việc, người nhận sẽ được thông báo.")).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(title) }).first()).toBeVisible();

  const teacher = await apiAs(request, ACCOUNTS.teacherA, SCHOOL_A);
  const tasks = await teacher.get<{ items: { id: string; title: string }[] }>(`/api/v1/tasks?q=${encodeURIComponent(title)}`);
  await teacher.patch(`/api/v1/tasks/${tasks.items[0].id}/status`, { status: "WAITING_APPROVAL" });

  const day = randomTuesday();
  await teacher.post("/api/v1/me/leave-requests", { leaveCode: "P", fromDate: day, toDate: day, halfDay: false, reason: "Việc gia đình (e2e)" });

  await page.goto("/hop-duyet");
  const taskCard = page.getByRole("listitem").filter({ hasText: title });
  await taskCard.getByRole("button", { name: "Duyệt" }).click();
  await expect(page.getByText("Đã duyệt hoàn thành việc.")).toBeVisible();
  await expect(taskCard).toHaveCount(0);

  const leaveCard = page.getByRole("listitem").filter({ hasText: "Việc gia đình (e2e)" }).first();
  await leaveCard.getByRole("button", { name: "Từ chối" }).click();
  await page.getByLabel("Lý do").fill("Trùng lịch dự giờ");
  await page.getByRole("dialog").getByRole("button", { name: "Từ chối" }).click();
  await expect(page.getByText("Đã từ chối đơn nghỉ.")).toBeVisible();
});
