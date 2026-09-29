import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node >= 25 có sẵn localStorage toàn cục (không dùng được nếu thiếu --localstorage-file) và che mất bản của jsdom.
// Gắn lại localStorage/sessionStorage của jsdom để test chạy giống trình duyệt trên mọi phiên bản Node.
const jsdomWindow = (globalThis as unknown as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, key, { value: jsdomWindow[key], configurable: true, writable: true });
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
