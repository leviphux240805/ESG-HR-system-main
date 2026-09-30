import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

/** Một thứ Hai ngẫu nhiên ở năm xa (mỗi lần chạy phép năm mới, không trùng đơn cũ, không vướng tháng đã khóa). */
function randomMonday() {
  const year = 2030 + Math.floor(Math.random() * 60);
  const month = 1 + Math.floor(Math.random() * 12);
  const date = new Date(year, month - 1, 3 + Math.floor(Math.random() * 15));
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    month: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
    label: `${date.getDate()}/${date.getMonth() + 1}`,
    display: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    day: date.getDate(),
  };
}

// Định nghĩa "xong" (2): giáo viên xin nghỉ trên điện thoại → hiệu trưởng duyệt → bảng công cập nhật
test("giáo viên xin nghỉ phép trên điện thoại, hiệu trưởng duyệt, bảng công thành P", async ({ browser }) => {
  const day = randomMonday();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const teacher = await phone.newPage();
  await login(teacher, ACCOUNTS.teacherA);
  await teacher.goto("/nghi-phep");
  await expect(teacher.getByRole("heading", { name: "Nghỉ phép" })).toBeVisible();
  // Giáo viên chỉ có tab của mình
  await expect(teacher.getByRole("tab", { name: "Chờ duyệt" })).toHaveCount(0);
  await teacher.getByRole("button", { name: "Xin nghỉ" }).click();
  const sheet = teacher.getByRole("dialog");
  await sheet.getByLabel("Từ ngày").fill(day.iso);
  await sheet.getByLabel("Đến ngày").fill(day.iso);
  await sheet.getByLabel("Lý do").fill("Đưa con đi khám");
  await sheet.getByRole("button", { name: "Gửi đơn" }).click();
  await expect(teacher.getByText("Đã gửi đơn xin nghỉ.")).toBeVisible();
  const card = teacher.getByRole("list", { name: "Đơn của tôi" }).getByTestId("leave-card").filter({ hasText: day.display });
  await expect(card).toContainText("Chờ duyệt");

  const desk = await browser.newPage();
  await login(desk, "0900000004");
  await desk.goto("/nghi-phep?tab=cho-duyet");
  await desk.getByRole("button", { name: `Duyệt đơn của Giáo Viên A ${day.display}` }).click();
  await expect(desk.getByText("Đã duyệt đơn, bảng công đã cập nhật.")).toBeVisible();
  await desk.goto(`/cham-cong?month=${day.month}`);
  await expect(desk.getByRole("grid", { name: "Bảng công tháng" }).getByRole("button", { name: `Giáo Viên A ngày ${day.label}: P` })).toBeVisible();
  await desk.close();

  await teacher.reload();
  await expect(card).toContainText("Đã duyệt");
  await teacher.goto(`/cua-toi/cham-cong?month=${day.month}`);
  await expect(teacher.getByRole("table", { name: "Bảng công của tôi" }).getByRole("cell", { name: `Ngày ${day.day}`, exact: true })).toContainText("P");
  await phone.close();
});

test("hiệu trưởng từ chối đơn có lý do; xem lịch nghỉ của cơ sở", async ({ browser }) => {
  const day = randomMonday();
  const teacher = await browser.newPage();
  await login(teacher, ACCOUNTS.teacherA);
  await teacher.goto("/nghi-phep");
  await teacher.getByRole("button", { name: "Xin nghỉ" }).click();
  const sheet = teacher.getByRole("dialog");
  await sheet.getByLabel("Loại nghỉ").click();
  await teacher.getByRole("option", { name: "K – Nghỉ không lương" }).click();
  await sheet.getByLabel("Từ ngày").fill(day.iso);
  await sheet.getByLabel("Đến ngày").fill(day.iso);
  await sheet.getByRole("checkbox", { name: /Chỉ nghỉ nửa ngày/ }).click();
  await sheet.getByLabel("Lý do").fill("Việc riêng");
  await sheet.getByRole("button", { name: "Gửi đơn" }).click();
  await expect(teacher.getByText("Đã gửi đơn xin nghỉ.")).toBeVisible();

  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await principal.goto("/nghi-phep?tab=cho-duyet");
  const card = principal.getByRole("list", { name: "Đơn chờ duyệt" }).getByTestId("leave-card").filter({ hasText: day.display });
  await expect(card).toContainText("1/2K");
  await card.getByRole("button", { name: "Từ chối" }).click();
  await principal.getByRole("dialog").getByLabel("Lý do").fill("Trùng lịch dự giờ");
  await principal.getByRole("dialog").getByRole("button", { name: "Từ chối" }).click();
  await expect(principal.getByText("Đã từ chối đơn.")).toBeVisible();
  await principal.getByRole("tab", { name: "Lịch nghỉ" }).click();
  await expect(principal.getByRole("table", { name: "Lịch nghỉ" })).toBeVisible();
  await principal.close();

  await teacher.reload();
  const mine = teacher.getByRole("list", { name: "Đơn của tôi" }).getByTestId("leave-card").filter({ hasText: day.display });
  await expect(mine).toContainText("Từ chối");
  await expect(mine).toContainText("Trùng lịch dự giờ");
  await teacher.close();
});
