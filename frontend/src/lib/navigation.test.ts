import { describe, expect, it } from "vitest";
import { can, type RoleCode } from "./permissions";
import { visibleNavGroups } from "./navigation";

const paths = (roles: RoleCode[]) =>
  visibleNavGroups((action, resource) => can(roles, action, resource)).flatMap((g) => g.items.map((i) => i.path));

describe("visibleNavGroups (bản demo)", () => {
  it("ban giám hiệu: Hôm nay là mục đầu tiên, có Hộp duyệt", () => {
    for (const role of ["PRINCIPAL", "VICE_PRINCIPAL"] as RoleCode[]) {
      expect(paths([role])[0]).toBe("/hom-nay");
      expect(paths([role])).toContain("/hop-duyet");
    }
  });

  it("giáo viên không thấy Hôm nay, Hộp duyệt", () => {
    expect(paths(["TEACHER"])).not.toContain("/hom-nay");
    expect(paths(["TEACHER"])).not.toContain("/hop-duyet");
  });
});
