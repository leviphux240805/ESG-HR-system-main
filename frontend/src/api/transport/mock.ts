import type { Transport } from "./index";

/**
 * Bản demo: request đi vào bộ dữ liệu giả trong trình duyệt. Nạp lười (dynamic import) để bản build thật không
 * kéo theo dữ liệu mẫu.
 */
export const mockTransport: Transport = async (input, init) => (await import("@/mock")).mockFetch(input, init);
