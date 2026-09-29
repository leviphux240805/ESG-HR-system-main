import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusBadge } from "./StatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorState } from "./States";
import { ApiError } from "@/api/errors";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("StatusBadge", () => {
  it("hiện nhãn tiếng Việt, cho phép module ghi đè, trạng thái lạ không làm vỡ giao diện", () => {
    render(
      <>
        <StatusBadge status="APPROVED" />
        <StatusBadge status="PRESENT" labels={{ PRESENT: { label: "Có mặt", tone: "success" } }} />
        <StatusBadge status="WEIRD" />
      </>,
    );
    expect(screen.getByText("Đã duyệt")).toBeInTheDocument();
    expect(screen.getByText("Có mặt")).toBeInTheDocument();
    expect(screen.getByText("WEIRD")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("chờ thao tác async; lỗi thì giữ hộp thoại mở, xong thì đóng", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, { title: "Xung đột", status: 409, detail: "Đã bị khóa." }))
      .mockResolvedValueOnce(undefined);

    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} confirmText="Khóa" />);

    await user.click(screen.getByRole("button", { name: "Khóa" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Khóa" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("ErrorState", () => {
  it("hiện thông điệp từ API và nút Thử lại", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(500)} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Đã xảy ra lỗi hệ thống");
    await user.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});
