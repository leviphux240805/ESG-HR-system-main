import type { Transport } from "./index";

/** Bản thật: gọi thẳng backend cùng origin (Vite proxy `/api` khi chạy dev). */
export const httpTransport: Transport = (input, init) => fetch(input, init);
