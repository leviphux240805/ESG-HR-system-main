import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttachmentDropzone, AttachmentList } from "./Attachments";
import { MonthGrid } from "./MonthGrid";
import type { StoredFile } from "@/api";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));

const files = vi.hoisted(() => ({ uploadFile: vi.fn() }));
vi.mock("@/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api")>()), uploadFile: files.uploadFile }));

const withQuery = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

describe("AttachmentList", () => {
  it("ảnh hiện thumbnail, file khác hiện chip tên + dung lượng; gỡ được file", async () => {
    const onRemove = vi.fn();
    const loadUrl = vi.fn(async (id: string) => `https://cdn/${id}`);
    render(
      withQuery(
        <AttachmentList
          files={[
            { id: "a", originalName: "lop.png", mimeType: "image/png", sizeBytes: 2048 },
            { id: "b", originalName: "bao-cao.pdf", mimeType: "application/pdf", sizeBytes: 3 * 1024 * 1024 },
          ]}
          loadUrl={loadUrl}
          onRemove={onRemove}
        />,
      ),
    );
    expect(await screen.findByAltText("lop.png")).toHaveAttribute("src", "https://cdn/a");
    expect(screen.getByText("bao-cao.pdf")).toBeInTheDocument();
    expect(screen.getByText("3 MB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gỡ bao-cao.pdf" }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });
});

describe("AttachmentDropzone", () => {
  it("chặn file quá giới hạn, upload file hợp lệ khi kéo thả", async () => {
    const onFiles = vi.fn();
    files.uploadFile.mockImplementation(async (file: File): Promise<StoredFile> => ({ id: file.name, originalName: file.name, mimeType: file.type, sizeBytes: file.size, status: "READY" }));
    render(<AttachmentDropzone maxSizeMb={1} onFiles={onFiles}>{(button) => <div data-testid="zone">{button}</div>}</AttachmentDropzone>);
    const zone = screen.getByTestId("zone").parentElement!;
    const drop = (list: File[]) => {
      const dataTransfer = { files: list, types: ["Files"] };
      zone.dispatchEvent(Object.assign(new Event("drop", { bubbles: true }), { dataTransfer, preventDefault() {} }));
    };
    drop([new File(["x"], "anh.png", { type: "image/png" }), new File([new Uint8Array(2 * 1024 * 1024)], "to.pdf", { type: "application/pdf" })]);
    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ id: "anh.png" })]));
    expect(files.uploadFile).toHaveBeenCalledTimes(1);
  });
});

describe("MonthGrid", () => {
  it("vẽ đủ hàng khi tắt ảo hóa, cột tổng và hàng tổng theo ngày", () => {
    const days = [
      { date: "2026-09-01", weekday: 2 },
      { date: "2026-09-06", weekday: 7 },
    ];
    render(
      <MonthGrid
        label="Sổ"
        nameHeader="Trẻ"
        rows={[{ id: "1", name: "An" }, { id: "2", name: "Bình" }]}
        rowKey={(r) => r.id}
        renderName={(r) => r.name}
        days={days}
        dayBackground={(d) => (d.weekday === 7 ? "bg-muted" : "")}
        renderCell={(r, d) => `${r.name}-${d.date.slice(8)}`}
        totals={[{ key: "c", label: "Có mặt", value: () => 1, footer: 2 }]}
        footer={{ label: "Tổng ngày", day: (d) => (d.weekday === 7 ? "" : 2) }}
        virtualize={false}
      />,
    );
    const grid = screen.getByRole("grid", { name: "Sổ" });
    expect(within(grid).getByText("Bình-06")).toBeInTheDocument();
    expect(within(grid).getByText("Có mặt")).toBeInTheDocument();
    const footer = within(grid).getByText("Tổng ngày").closest('[role="row"]') as HTMLElement;
    expect(within(footer).getAllByText("2")).toHaveLength(2);
  });
});
