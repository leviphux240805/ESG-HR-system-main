import { expect, test } from "@playwright/test";
import { ACCOUNTS } from "./helpers";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

// Backend giới hạn 1 yêu cầu/phút mỗi tài khoản: chạy lại test trong vòng 1 phút sẽ không có email mới.
test("quên mật khẩu: gửi yêu cầu, nhận email có link, mở được trang đặt lại", async ({ page, request }) => {
  await request.delete(`${MAILPIT}/api/v1/messages`);

  // Trang đăng nhập tạm ẩn link (chưa dùng email); luồng email giữ lại để bật lại sau
  await page.goto("/login");
  await expect(page.getByText(/Liên hệ hiệu trưởng để được cấp hoặc đặt lại mật khẩu/)).toBeVisible();
  await page.goto("/forgot-password");
  await page.getByLabel("Email hoặc số điện thoại").fill(ACCOUNTS.staffB);
  await page.getByRole("button", { name: "Gửi link đặt lại mật khẩu" }).click();
  await expect(page.getByText(/Nếu tài khoản tồn tại, email hướng dẫn/)).toBeVisible();

  let link = "";
  await expect(async () => {
    const list = await (await request.get(`${MAILPIT}/api/v1/messages`)).json();
    const message = list.messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address === "nhanvien.b@preschool.local"),
    );
    expect(message).toBeTruthy();
    const detail = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    link = /\/reset-password\?token=[\w-]+/.exec(detail.Text)?.[0] ?? "";
    expect(link).not.toBe("");
  }).toPass({ timeout: 10_000 });

  // Không đổi mật khẩu thật (giữ tài khoản seed); chỉ kiểm tra link mở đúng trang
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Đặt mật khẩu mới" })).toBeVisible();
  await expect(page.getByLabel("Nhập lại mật khẩu mới")).toBeVisible();
});
