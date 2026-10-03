import { describe, expect, it } from "vitest";
import { can, isPrincipal, rolesInScope } from "./permissions";

const A = "school-a";
const B = "school-b";

describe("can – ma trận quyền theo thiết kế", () => {
  it("hiệu trưởng: toàn quyền mọi module kể cả lương, tài khoản, trường", () => {
    expect(can(["PRINCIPAL"], "manage", "staff")).toBe(true);
    expect(can(["PRINCIPAL"], "manage", "finance")).toBe(true);
    expect(can(["PRINCIPAL"], "manage", "payroll")).toBe(true);
    expect(can(["PRINCIPAL"], "approve", "payroll")).toBe(true);
    expect(can(["PRINCIPAL"], "manage", "settings")).toBe(true);
    expect(can(["PRINCIPAL"], "approve", "attendance")).toBe(true);
  });

  it("phó hiệu trưởng: chỉ module thuộc nhóm được giao, không vào cấu hình trường và tài khoản", () => {
    const vice = { role: "VICE_PRINCIPAL" as const, groups: ["CLASSROOM", "NUTRITION"] as const };
    expect(can([vice], "manage", "classes")).toBe(true);
    expect(can([vice], "manage", "menu")).toBe(true);
    expect(can([vice], "view", "health")).toBe(true);
    expect(can([vice], "view", "finance")).toBe(false);
    expect(can([vice], "view", "staff")).toBe(false);
    expect(can([vice], "manage", "settings")).toBe(false);
    expect(can([vice], "view", "approvals")).toBe(true);
    expect(can(["VICE_PRINCIPAL"], "view", "approvals")).toBe(false);
    expect(can([{ role: "VICE_PRINCIPAL", groups: ["FINANCE"] }], "approve", "payroll")).toBe(false);
    expect(can([{ role: "VICE_PRINCIPAL", groups: ["HR"] }], "approve", "attendance")).toBe(true);
  });

  it("kế toán: quản lý học phí và lương, chỉ xem nhân sự, không vào sức khỏe", () => {
    expect(can(["ACCOUNTANT"], "manage", "finance")).toBe(true);
    expect(can(["ACCOUNTANT"], "manage", "payroll")).toBe(true);
    expect(can(["ACCOUNTANT"], "view", "staff")).toBe(true);
    expect(can(["ACCOUNTANT"], "manage", "staff")).toBe(false);
    expect(can(["ACCOUNTANT"], "view", "health")).toBe(false);
    expect(can(["ACCOUNTANT"], "approve", "payroll")).toBe(false);
  });

  it("giáo viên: quản lý lớp được phân công, chỉ xem tài liệu, không vào học phí", () => {
    expect(can(["TEACHER"], "manage", "classes")).toBe(true);
    expect(can(["TEACHER"], "view", "documents")).toBe(true);
    expect(can(["TEACHER"], "manage", "documents")).toBe(false);
    expect(can(["TEACHER"], "view", "finance")).toBe(false);
    // Mức "Mình" không mở trang quản lý nhân sự
    expect(can(["TEACHER"], "view", "staff")).toBe(false);
  });

  it("cấp dưỡng xem sĩ số, quản lý thực đơn; nhân viên khác không vào lớp", () => {
    expect(can(["KITCHEN"], "view", "classes")).toBe(true);
    expect(can(["KITCHEN"], "manage", "classes")).toBe(false);
    expect(can(["KITCHEN"], "view", "children")).toBe(false);
    expect(can(["NURSE"], "view", "children")).toBe(true);
    expect(can(["KITCHEN"], "manage", "menu")).toBe(true);
    expect(can(["KITCHEN"], "view", "health")).toBe(false);
    expect(can(["TEACHER"], "manage", "menu")).toBe(false);
    expect(can(["TEACHER"], "manage", "health")).toBe(true);
    expect(can(["STAFF"], "view", "classes")).toBe(false);
  });

  it("nhiều vai trò: chỉ cần một vai trò cho phép", () => {
    expect(can(["TEACHER", "ACCOUNTANT"], "manage", "finance")).toBe(true);
    expect(can([], "view", "staff")).toBe(false);
  });
});

describe("rolesInScope – vai trò theo trường đang chọn", () => {
  const grants = [
    { role: "TEACHER" as const, schoolId: A },
    { role: "ACCOUNTANT" as const, schoolId: B },
    { role: "VICE_PRINCIPAL" as const, schoolId: A, functionGroups: ["HR" as const] },
    { role: "VICE_PRINCIPAL" as const, schoolId: B, functionGroups: ["FINANCE" as const] },
  ];

  it("chỉ tính vai trò và nhóm của trường đang chọn", () => {
    expect(rolesInScope(grants, A)).toEqual([{ role: "TEACHER" }, { role: "VICE_PRINCIPAL", groups: ["HR"] }]);
    expect(can(rolesInScope(grants, A), "manage", "finance")).toBe(false);
    expect(can(rolesInScope(grants, B), "manage", "finance")).toBe(true);
  });

  it("'Tất cả trường' gộp vai trò và nhóm của mọi trường", () => {
    const all = rolesInScope(grants, null);
    expect(all.map((r) => r.role)).toEqual(["TEACHER", "ACCOUNTANT", "VICE_PRINCIPAL"]);
    expect(all.find((r) => r.role === "VICE_PRINCIPAL")?.groups).toEqual(["HR", "FINANCE"]);
  });

  it("hiệu trưởng ở ít nhất một trường", () => {
    expect(isPrincipal(grants)).toBe(false);
    expect(isPrincipal([{ role: "PRINCIPAL" }])).toBe(true);
  });
});
