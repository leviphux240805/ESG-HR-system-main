import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFile } from "./files";

// API backend trả link upload; lỗi chỉ xảy ra ở bước PUT thẳng vào kho file
vi.mock("./client", () => ({
  api: {
    POST: vi.fn(async () => ({
      data: {
        file: { id: "f1", originalName: "a.pdf", mimeType: "application/pdf", sizeBytes: 3, status: "PENDING" },
        uploadUrl: "https://kho.example/a.pdf?sig=1",
        method: "PUT",
        headers: { "content-type": "application/pdf" },
      },
    })),
  },
  unwrap: (res: { data: unknown }) => res.data,
}));

describe("uploadFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("kho file không phản hồi thì báo lỗi tiếng Việt, không treo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const file = new File(["%PD"], "a.pdf", { type: "application/pdf" });
    await expect(uploadFile(file)).rejects.toMatchObject({ message: "Không kết nối được tới kho lưu trữ file, vui lòng thử lại." });
  });
});
