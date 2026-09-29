import { describe, expect, it } from "vitest";
import { fileNameFromDisposition } from "./download";

describe("fileNameFromDisposition", () => {
  it("ưu tiên filename* UTF-8 để giữ tên tiếng Việt", () => {
    expect(
      fileNameFromDisposition(
        `attachment; filename="Bang_luong.xlsx"; filename*=UTF-8''B%E1%BA%A3ng%20l%C6%B0%C6%A1ng%209-2026.xlsx`,
        "x.xlsx",
      ),
    ).toBe("Bảng lương 9-2026.xlsx");
  });

  it("dùng filename thường hoặc tên mặc định", () => {
    expect(fileNameFromDisposition('attachment; filename="bao-cao.xlsx"', "x.xlsx")).toBe("bao-cao.xlsx");
    expect(fileNameFromDisposition(null, "du-lieu.xlsx")).toBe("du-lieu.xlsx");
  });
});
