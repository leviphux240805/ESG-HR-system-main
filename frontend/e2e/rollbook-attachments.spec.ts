import { expect, test } from "@playwright/test";
import { ACCOUNTS, SCHOOL_A, apiAs, login, randomDigits } from "./helpers";

const CLASS_CHOI_1 = "00000000-0000-0000-0000-000000000701";

/** PNG 1×1 hợp lệ để thử thumbnail. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** Ngày gần nhất không phải Chủ nhật (ngày học), dạng dd/MM/yyyy như nhãn ô. */
function lastSchoolDay() {
  const d = new Date();
  if (d.getDay() === 0) d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

test("sổ điểm danh: sửa ô, tổng cập nhật, xuất Excel", async ({ page }) => {
  await login(page, ACCOUNTS.owner);
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await page.goto(`/so-diem-danh?classId=${CLASS_CHOI_1}`);
  const grid = page.getByRole("grid", { name: "Sổ điểm danh lớp Chồi 1" });
  await expect(grid).toBeVisible();
  await expect(grid.getByText("Có mặt theo ngày")).toBeVisible();

  await grid.getByRole("button", { name: new RegExp(`^Nguyễn Minh An ngày ${lastSchoolDay()}`) }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /Vắng có phép/ }).click();
  await dialog.getByLabel("Ghi chú").fill("Đi khám");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu điểm danh.")).toBeVisible();
  await expect(grid.getByRole("button", { name: new RegExp(`^Nguyễn Minh An ngày ${lastSchoolDay()}: Vắng có phép`) })).toHaveText("P");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/^so-diem-danh-.*\.xlsx$/);
});

test("công việc: đính kèm ảnh vào nội dung và file trong bình luận", async ({ page, request }) => {
  const title = `Việc có file ${randomDigits(5)}`;
  const owner = await apiAs(request, ACCOUNTS.owner, SCHOOL_A);
  const staff = await owner.get<{ items: { id: string; fullName: string }[] }>("/api/v1/staff?q=Gi%C3%A1o%20Vi%C3%AAn%20A&size=5");
  await owner.post("/api/v1/tasks", { schoolId: SCHOOL_A, title, priority: "MEDIUM", dueAt: "2027-12-31T16:59:00Z", assigneeStaffIds: [staff.items[0].id] });

  await login(page, ACCOUNTS.owner);
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();
  await page.goto("/cong-viec");
  await page.getByRole("button", { name: new RegExp(title) }).first().click();
  const sheet = page.getByRole("dialog");

  await sheet.getByTestId("attach-input").first().setInputFiles({ name: "lop-hoc.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Đã đính kèm.")).toBeVisible();
  await expect(sheet.getByAltText("lop-hoc.png")).toBeVisible();

  await sheet.getByTestId("attach-input").last().setInputFiles({ name: "bien-ban.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await expect(sheet.getByText("bien-ban.pdf")).toBeVisible();
  await sheet.getByLabel("Bình luận", { exact: true }).fill("Gửi biên bản");
  await sheet.getByRole("button", { name: "Gửi bình luận" }).click();
  const comment = sheet.getByRole("listitem").filter({ hasText: "Gửi biên bản" });
  await expect(comment.getByText("bien-ban.pdf")).toBeVisible();
  await expect(comment.getByText(/\d+ B$/)).toBeVisible();
});
