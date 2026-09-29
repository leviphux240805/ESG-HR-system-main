import { defineConfig, devices } from "@playwright/test";

/**
 * E2E cho luồng chính. Cần sẵn: `docker compose up -d` (Postgres, MinIO, Mailpit) và backend profile dev
 * (có seed). Playwright tự chạy Vite (hoặc dùng lại server đang chạy ở E2E_WEB_PORT).
 *
 *   E2E_WEB_PORT      cổng Vite (mặc định 8080)
 *   E2E_API_TARGET    backend cho proxy /api (mặc định http://localhost:8081)
 *   E2E_MAILPIT_URL   API Mailpit (mặc định http://localhost:8025)
 */
const webPort = Number(process.env.E2E_WEB_PORT ?? 8080);
const apiTarget = process.env.E2E_API_TARGET ?? "http://localhost:8081";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --port ${webPort} --strictPort`,
    url: `http://localhost:${webPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_API_PROXY_TARGET: apiTarget,
      // Bật menu xem trước để kiểm tra trang 403 khi vai trò không đủ quyền
      VITE_PREVIEW_MODULES: "true",
    },
  },
});
