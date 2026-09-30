import { describe, expect, it } from "vitest";
import { can, type RoleCode } from "./permissions";
import { findNavItem, visibleNavGroups } from "./navigation";

const paths = (roles: RoleCode[], phase: number, preview: boolean) =>
  visibleNavGroups((action, resource) => can(roles, action, resource), phase, preview).flatMap((g) =>
    g.items.map((i) => i.path),
  );

describe("visibleNavGroups", () => {
  it("giai đoạn 1: chỉ có trang chung, mục của giai đoạn sau bị ẩn với mọi vai trò", () => {
    // Trang chung luôn hiện
    expect(paths(["OWNER"], 1, false)).toEqual(["/", "/files-demo"]);
    expect(paths(["TEACHER"], 1, false)).toEqual(["/", "/files-demo"]);
  });

  it("xem trước: lọc đúng theo ma trận quyền", () => {
    const teacher = paths(["TEACHER"], 1, true);
    expect(teacher).toContain("/tai-lieu");
    expect(teacher).toContain("/diem-danh");
    expect(teacher).toContain("/cua-toi/phieu-luong");
    expect(teacher).not.toContain("/nhan-su");
    expect(teacher).not.toContain("/hoc-phi");
    expect(teacher).not.toContain("/luong");

    const accountant = paths(["ACCOUNTANT"], 1, true);
    expect(accountant).toContain("/hoc-phi");
    expect(accountant).toContain("/luong");
    expect(accountant).not.toContain("/suc-khoe");
    expect(accountant).not.toContain("/tai-khoan");

    const admin = paths(["CHAIN_ADMIN"], 1, true);
    expect(admin).toContain("/tai-khoan");
  });

  it("nhóm 'Của tôi' hiện cho mọi người (xem trước vì trang chưa làm)", () => {
    for (const role of ["OWNER", "STAFF", "KITCHEN"] as RoleCode[]) {
      expect(paths([role], 4, true)).toEqual(
        expect.arrayContaining(["/cua-toi/ho-so", "/cua-toi/viec", "/cua-toi/cham-cong", "/cua-toi/phieu-luong"]),
      );
    }
  });

  it("mục chỉ hiện khi đã tới giai đoạn VÀ đã có trang; giai đoạn sau vẫn ẩn", () => {
    const principal = paths(["PRINCIPAL"], 2, false);
    expect(principal).toContain("/nhan-su");
    expect(principal).not.toContain("/cham-cong");
    // Đã tới giai đoạn nhưng chưa có trang: không hiện "Sắp có" cho người dùng thật
    expect(paths(["CHAIN_ADMIN"], 7, false)).not.toContain("/bao-cao");
    expect(paths(["TEACHER"], 2, false)).not.toContain("/nhan-su");
  });
});

describe("findNavItem", () => {
  it("trang con cố định không bị nhận nhầm là /nhan-su/:id", () => {
    expect(findNavItem("/nhan-su/moi")?.subLabel).toBe("Thêm nhân viên");
    expect(findNavItem("/nhan-su/giay-to-het-han")?.subLabel).toBe("Giấy tờ sắp hết hạn");
    expect(findNavItem("/nhan-su/00000000-0000-0000-0000-000000000105")?.subLabel).toBe("Hồ sơ nhân viên");
    expect(findNavItem("/nhan-su")?.item.path).toBe("/nhan-su");
  });
});
