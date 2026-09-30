/**
 * Nguồn dữ liệu của bản build: `api` gọi backend thật, `mock` chạy bằng dữ liệu giả trong trình duyệt
 * (bản demo giới thiệu khách hàng). Chọn bằng biến môi trường `VITE_DATA_SOURCE`.
 */
export type DataSource = "api" | "mock";

export const DATA_SOURCE: DataSource = import.meta.env.VITE_DATA_SOURCE === "mock" ? "mock" : "api";

/** Đang chạy bản demo: hiện nhãn DEMO, đăng nhập chọn vai trò, nút khôi phục dữ liệu. */
export const IS_DEMO = DATA_SOURCE === "mock";
