import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { ACCOUNTS, createStaffA, login, randomDigits } from "./helpers";

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });

// Định nghĩa "xong" phần nhân sự: tạo bằng quét CCCD → tải hợp đồng → điều chuyển → lịch sử đúng
test("luồng nhân sự: quét CCCD, tải hợp đồng, điều chuyển sang Cơ sở B, lịch sử đúng", async ({ page, browser }) => {
  const citizenId = randomDigits(12);
  const suffix = randomDigits(4);
  const upperName = `VÕ THỊ ĐIỀU CHUYỂN ${suffix}`;
  const name = `Võ Thị Điều Chuyển ${suffix}`;
  const qr = await QRCode.toBuffer(`${citizenId}||${upperName}|12071995|Nữ|Số 3, Phường Cũ, Hà Nội|01022023`, { width: 480 });

  await login(page, ACCOUNTS.owner); // hiệu trưởng
  await page.getByLabel("Chọn trường").click();
  await page.getByRole("option", { name: "Trường A – Hoa Sen" }).click();

  await page.goto("/nhan-su/moi");
  await page.getByRole("button", { name: "Quét CCCD" }).click();
  await page.getByTestId("cccd-front").setInputFiles({ name: "mat-truoc.png", mimeType: "image/png", buffer: qr });
  await expect(page.getByTestId("cccd-info")).toContainText(citizenId);
  await page.getByRole("button", { name: "Dùng thông tin này" }).click();
  await page.getByLabel("Số điện thoại").fill("07" + randomDigits(8));
  await page.getByLabel("Vị trí").click();
  await page.getByRole("option", { name: "Giáo viên" }).click();
  // Vào làm từ trước: điều chuyển phải có hiệu lực sau ngày bắt đầu ở cơ sở hiện tại
  await page.getByLabel("Ngày vào làm").fill("2026-09-01");
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const profileUrl = page.url();

  // Tải hợp đồng
  await page.getByRole("tab", { name: "Hợp đồng & quyết định" }).click();
  await page.getByRole("button", { name: "Thêm hợp đồng" }).click();
  let sheet = page.getByRole("dialog");
  await sheet.getByLabel("Loại hợp đồng").click();
  await page.getByRole("option", { name: "Thử việc" }).click();
  await sheet.getByLabel("Ngày bắt đầu").fill("2026-09-01");
  await sheet.getByLabel("Ngày kết thúc").fill("2026-10-31");
  await sheet.getByTestId("file-input").setInputFiles(pdf("hop-dong-thu-viec.pdf"));
  await expect(sheet.getByText("hop-dong-thu-viec.pdf")).toBeVisible();
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Thử việc" })).toContainText("hop-dong-thu-viec.pdf");

  // Điều chuyển có hiệu lực hôm nay, kèm quyết định
  await page.getByRole("button", { name: "Điều chuyển" }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Cơ sở mới").click();
  await page.getByRole("option", { name: "Trường B – Hoa Mai" }).click();
  await sheet.getByTestId("file-input").setInputFiles(pdf("qd-dieu-chuyen.pdf"));
  await expect(sheet.getByText("qd-dieu-chuyen.pdf")).toBeVisible();
  await sheet.getByRole("button", { name: "Điều chuyển" }).click();
  await expect(page.getByText(`${name} đã chuyển sang Trường B – Hoa Mai.`)).toBeVisible();
  // Đang xem Cơ sở A nên tự chuyển sang Cơ sở B để vẫn thấy hồ sơ
  await expect(page.getByLabel("Chọn trường")).toContainText("Trường B – Hoa Mai");
  await expect(page.getByText(/· Trường B – Hoa Mai$/)).toBeVisible();

  // Lịch sử: giữ giai đoạn ở Cơ sở A, giai đoạn hiện tại ở Cơ sở B
  await page.getByRole("tab", { name: "Lịch sử" }).click();
  const timeline = page.getByRole("list", { name: "Quá trình công tác" });
  await expect(timeline.getByRole("listitem")).toHaveCount(2);
  await expect(timeline.getByRole("listitem").filter({ hasText: "Trường A – Hoa Sen" })).not.toContainText("Hiện tại");
  await expect(timeline.getByRole("listitem").filter({ hasText: "Trường B – Hoa Mai" })).toContainText("Hiện tại");
  await expect(timeline).toContainText("qd-dieu-chuyen.pdf");
  const log = page.getByRole("list", { name: "Nhật ký thay đổi" });
  await expect(log).toContainText("Điều chuyển cơ sở");
  await expect(log).toContainText("Từ Trường A – Hoa Sen sang Trường B – Hoa Mai");
  await expect(log).toContainText("Thêm hợp đồng");
  await expect(log).toContainText("Tạo hồ sơ");

  // Hiệu trưởng Cơ sở A không còn xem được hồ sơ này
  const principal = await browser.newPage();
  await login(principal, "0900000004");
  await principal.goto(profileUrl);
  await expect(principal.getByText("Không tìm thấy hồ sơ")).toBeVisible();
  await principal.close();
});

test("hiệu trưởng: không có tab lương, không điều chuyển, được cho nghỉ việc", async ({ page, request }) => {
  const name = `Đỗ Văn Nghỉ ${randomDigits(4)}`;
  const staff = await createStaffA(request, name);

  await login(page, "0900000004");
  await page.goto(`/nhan-su/${staff.id}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Lương & phụ cấp" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Điều chuyển" })).toHaveCount(0);
  // Mở thẳng ?tab=salary cũng rơi về tab thông tin
  await page.goto(`/nhan-su/${staff.id}?tab=salary`);
  await expect(page.getByRole("tab", { name: "Thông tin cá nhân" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Cho nghỉ việc" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Lý do").fill("Chuyển công tác nơi khác");
  await sheet.getByRole("button", { name: "Cho nghỉ việc" }).click();
  await expect(page.getByText("Đã cho nhân viên nghỉ việc.")).toBeVisible();
  await expect(page.getByText("Đã nghỉ", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cho nghỉ việc" })).toHaveCount(0);
  await expect(page.getByText("Chuyển công tác nơi khác")).toBeVisible();
});

test("văn phòng điều hành điều chỉnh lương; kế toán chỉ xem", async ({ page, request, browser }) => {
  const name = `Bùi Thị Lương ${randomDigits(4)}`;
  const staff = await createStaffA(request, name);

  await login(page, ACCOUNTS.owner);
  await page.goto(`/nhan-su/${staff.id}?tab=salary`);
  await expect(page.getByText("Chưa có cấu hình lương")).toBeVisible();
  await page.getByRole("button", { name: "Điều chỉnh lương" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Hiệu lực từ ngày").fill("2026-09-01");
  await sheet.getByLabel("Lương cơ bản (đồng/tháng)").fill("6500000");
  await sheet.getByLabel("Ăn trưa").fill("700000");
  await sheet.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu cấu hình lương mới.")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "6.500.000" })).toBeVisible();
  await expect(page.getByText(/Ăn trưa: 700\.000/).first()).toBeVisible();

  // Kế toán Cơ sở A: xem lương của Nguyễn Thị Lan (seed có cấu hình lương), không có nút điều chỉnh
  const accountant = await browser.newPage();
  await login(accountant, "0900000003");
  await accountant.goto("/nhan-su/00000000-0000-0000-0000-000000000105?tab=salary");
  await expect(accountant.getByText("Lương đang áp dụng")).toBeVisible();
  await expect(accountant.getByRole("button", { name: "Điều chỉnh lương" })).toHaveCount(0);
  await accountant.getByRole("tab", { name: "Thông tin cá nhân" }).click();
  await expect(accountant.getByRole("heading", { name: "Nguyễn Thị Lan" })).toBeVisible();
  await expect(accountant.getByRole("button", { name: "Sửa thông tin" })).toHaveCount(0);
  await accountant.close();
});
