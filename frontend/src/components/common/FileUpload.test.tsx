import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { MultiFileUpload } from "./FileUpload";
import type { StoredFile } from "@/api/files";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const files = vi.hoisted(() => ({ uploadFile: vi.fn(), openFile: vi.fn() }));
vi.mock("@/api/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/files")>()),
  uploadFile: files.uploadFile,
  openFile: files.openFile,
}));

const stored = (name: string): StoredFile => ({
  id: name,
  originalName: name,
  mimeType: "application/pdf",
  sizeBytes: 10,
  status: "READY",
});

describe("MultiFileUpload", () => {
  it("chặn file sai loại/quá lớn trước khi gọi API, file hợp lệ vẫn được thêm", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    files.uploadFile.mockImplementation(async (file: File) => stored(file.name));

    render(<MultiFileUpload label="Hồ sơ" value={[]} onChange={onChange} maxSizeMb={1} />);

    await user.upload(screen.getByTestId("file-input"), [
      new File(["%PDF"], "hop-dong.pdf", { type: "application/pdf" }),
      new File(["x"], "virus.exe", { type: "application/x-msdownload" }),
      new File([new Uint8Array(2 * 1024 * 1024)], "to.pdf", { type: "application/pdf" }),
    ]);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([stored("hop-dong.pdf")]));
    expect(files.uploadFile).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("loại file không được hỗ trợ"));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("vượt quá 1 MB"));
  });

  it("gỡ file khỏi danh sách", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiFileUpload label="Hồ sơ" value={[stored("a.pdf"), stored("b.pdf")]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Gỡ a.pdf" }));
    expect(onChange).toHaveBeenCalledWith([stored("b.pdf")]);
  });
});
