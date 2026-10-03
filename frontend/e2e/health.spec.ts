import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

const CLASS_CHOI_1 = "00000000-0000-0000-0000-000000000701";
const KITCHEN_B = "0900000007";
/** Tuần xa trong tương lai để không đụng thực đơn seed. */
const WEEK = "2027-01-04";

test.describe("thực đơn & sức khỏe", () => {
  test("giáo viên nhập cân đo trên điện thoại và thấy kênh WHO", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await login(page, ACCOUNTS.teacherA);
    const today = new Date().toLocaleDateString("sv-SE");
    await page.goto(`/suc-khoe/can-do?lop=${CLASS_CHOI_1}&ngay=${today}`);
    await page.getByLabel("Cân nặng của Nguyễn Minh An").fill("19.2");
    await page.getByLabel("Chiều cao của Nguyễn Minh An").fill("111.5");
    await page.getByRole("button", { name: "Lưu cân đo" }).click();
    await expect(page.getByText(/Đã lưu cân đo/)).toBeVisible();
    await expect(page.getByText(/Đã cân đo [1-9]/)).toBeVisible();
  });

  test("cấp dưỡng lên thực đơn trường mình và thấy món trong lưới", async ({ page }) => {
    await login(page, KITCHEN_B);
    await page.goto(`/thuc-don?week=${WEEK}`);
    await page.getByRole("button", { name: "Sửa thực đơn" }).click();
    await page.getByRole("button", { name: "Thêm món" }).first().click();
    const picker = page.getByRole("dialog");
    await picker.getByLabel("Tìm món").fill("Súp cua");
    await picker.getByRole("button", { name: /Súp cua/ }).click();
    await page.getByRole("button", { name: "Lưu thực đơn" }).click();
    await expect(page.getByText("Đã lưu thực đơn.")).toBeVisible();
    await expect(page.getByText("Súp cua").first()).toBeVisible();
    // Số suất theo sĩ số (tuần tương lai chưa điểm danh)
    await expect(page.getByText(/\d+ suất \(theo sĩ số\)/).first()).toBeVisible();
  });

  test("hiệu trưởng nhiều trường xem dashboard so sánh các trường", async ({ page }) => {
    await login(page, ACCOUNTS.owner);
    await page.goto("/bao-cao");
    await expect(page.getByText("So sánh các cơ sở")).toBeVisible();
    await expect(page.getByRole("button", { name: "Danh sách trẻ" })).toBeVisible();
  });
});
