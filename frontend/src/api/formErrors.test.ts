import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { applyApiErrors } from "./formErrors";
import { ApiError } from "./errors";

type Values = { fullName: string; email: string; address: { wardCode: string } };

function setup() {
  return renderHook(() =>
    useForm<Values>({ defaultValues: { fullName: "", email: "", address: { wardCode: "" } } }),
  ).result;
}

const validation = (errors: { field: string; message: string }[]) =>
  new ApiError(400, { title: "Yêu cầu không hợp lệ", status: 400, detail: "Dữ liệu không hợp lệ.", code: "VALIDATION_FAILED", errors });

describe("applyApiErrors", () => {
  it("gắn lỗi theo trường vào đúng ô nhập, kể cả trường lồng, không toast", () => {
    const form = setup();
    const notify = vi.fn();

    let mapped = false;
    act(() => {
      mapped = applyApiErrors(
        validation([
          { field: "email", message: "email không hợp lệ" },
          { field: "address.wardCode", message: "không được để trống" },
        ]),
        form.current,
        { notify },
      );
    });

    expect(mapped).toBe(true);
    expect(form.current.getFieldState("email").error?.message).toBe("email không hợp lệ");
    expect(form.current.getFieldState("address.wardCode").error?.message).toBe("không được để trống");
    expect(notify).not.toHaveBeenCalled();
  });

  it("lỗi của trường không có trên form thì toast", () => {
    const form = setup();
    const notify = vi.fn();

    act(() => {
      applyApiErrors(
        validation([
          { field: "email", message: "email không hợp lệ" },
          { field: "schoolId", message: "phải chọn cơ sở" },
        ]),
        form.current,
        { notify },
      );
    });

    expect(form.current.getFieldState("email").error).toBeDefined();
    expect(notify).toHaveBeenCalledWith("phải chọn cơ sở");
  });

  it("lỗi chung (không có errors[]) chỉ toast thông điệp tiếng Việt, không lộ mã lỗi", () => {
    const form = setup();
    const notify = vi.fn();
    const error = new ApiError(409, { title: "Xung đột dữ liệu", status: 409, detail: "Email đã được dùng.", code: "DATA_CONFLICT" });

    let mapped = true;
    act(() => {
      mapped = applyApiErrors(error, form.current, { notify });
    });

    expect(mapped).toBe(false);
    expect(notify).toHaveBeenCalledWith("Email đã được dùng.");
    expect(notify.mock.calls[0][0]).not.toContain("DATA_CONFLICT");
  });

  it("bỏ tiền tố tên trường của DTO lồng", () => {
    const form = setup();
    const notify = vi.fn();
    act(() => {
      applyApiErrors(validation([{ field: "fields.email", message: "email không hợp lệ" }]), form.current, {
        notify,
        stripPrefix: "fields.",
      });
    });
    expect(form.current.getFieldState("email").error?.message).toBe("email không hợp lệ");
    expect(notify).not.toHaveBeenCalled();
  });

  it("lỗi mạng", () => {
    const form = setup();
    const notify = vi.fn();
    act(() => {
      applyApiErrors(new TypeError("Failed to fetch"), form.current, { notify });
    });
    expect(notify).toHaveBeenCalledWith("Không kết nối được máy chủ. Vui lòng kiểm tra mạng.");
  });
});
