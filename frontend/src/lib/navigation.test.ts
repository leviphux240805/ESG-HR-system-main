import { describe, expect, it } from "vitest";
import { type RoleCode, type ScopedRole, can } from "./permissions";
import { visibleNavGroups } from "./navigation";

const paths = (roles: (RoleCode | ScopedRole)[]) =>
  visibleNavGroups((action, resource) => can(roles, action, resource)).flatMap((g) => g.items.map((i) => i.path));

describe("visibleNavGroups (bản demo)", () => {
  it("ban giám hiệu: Hôm nay là mục đầu tiên, có Hộp duyệt", () => {
    for (const role of ["PRINCIPAL", { role: "VICE_PRINCIPAL", groups: ["CLASSROOM"] }] as (RoleCode | ScopedRole)[]) {
      expect(paths([role])[0]).toBe("/hom-nay");
      expect(paths([role])).toContain("/hop-duyet");
    }
  });

  it("giáo viên: Điểm danh là trang đầu tiên", () => {
    expect(paths(["TEACHER"])[0]).toBe("/diem-danh");
  });

  it("giáo viên không thấy Hôm nay, Hộp duyệt", () => {
    expect(paths(["TEACHER"])).not.toContain("/hom-nay");
    expect(paths(["TEACHER"])).not.toContain("/hop-duyet");
  });

  it("hiệu trưởng thấy Trường, Tài khoản; phó hiệu trưởng chỉ thấy module thuộc nhóm được giao", () => {
    expect(paths(["PRINCIPAL"])).toEqual(expect.arrayContaining(["/truong", "/tai-khoan", "/hoc-phi/phieu-thu"]));
    const vice = paths([{ role: "VICE_PRINCIPAL", groups: ["CLASSROOM"] }]);
    expect(vice).toContain("/lop-hoc");
    expect(vice).not.toContain("/truong");
    expect(vice).not.toContain("/tai-khoan");
    expect(vice).not.toContain("/hoc-phi/phieu-thu");
    expect(vice).not.toContain("/nhan-su");
  });
});
