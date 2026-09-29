import { describe, expect, it } from "vitest";
import { can, rolesInScope } from "./permissions";

const A = "school-a";
const B = "school-b";

describe("can – ma trận quyền theo thiết kế", () => {
  it("chủ chuỗi: quản lý nhân sự, chỉ xem học phí, duyệt lương", () => {
    expect(can(["OWNER"], "manage", "staff")).toBe(true);
    expect(can(["OWNER"], "view", "finance")).toBe(true);
    expect(can(["OWNER"], "manage", "finance")).toBe(false);
    expect(can(["OWNER"], "approve", "payroll")).toBe(true);
  });

  it("kế toán: quản lý học phí và lương, chỉ xem nhân sự, không vào sức khỏe", () => {
    expect(can(["ACCOUNTANT"], "manage", "finance")).toBe(true);
    expect(can(["ACCOUNTANT"], "manage", "payroll")).toBe(true);
    expect(can(["ACCOUNTANT"], "view", "staff")).toBe(true);
    expect(can(["ACCOUNTANT"], "manage", "staff")).toBe(false);
    expect(can(["ACCOUNTANT"], "view", "health")).toBe(false);
    expect(can(["ACCOUNTANT"], "approve", "payroll")).toBe(false);
  });

  it("hiệu trưởng: duyệt nghỉ, không mở trang quản lý lương (chỉ phiếu của mình)", () => {
    expect(can(["PRINCIPAL"], "approve", "attendance")).toBe(true);
    expect(can(["PRINCIPAL"], "view", "payroll")).toBe(false);
    expect(can(["PRINCIPAL"], "manage", "staff")).toBe(true);
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
    expect(can(["KITCHEN"], "manage", "health")).toBe(true);
    expect(can(["STAFF"], "view", "classes")).toBe(false);
  });

  it("văn phòng điều hành: cấu hình và tài khoản, chỉ xem lương", () => {
    expect(can(["CHAIN_ADMIN"], "manage", "settings")).toBe(true);
    expect(can(["CHAIN_ADMIN"], "view", "payroll")).toBe(true);
    expect(can(["CHAIN_ADMIN"], "manage", "payroll")).toBe(false);
  });

  it("nhiều vai trò: chỉ cần một vai trò cho phép", () => {
    expect(can(["TEACHER", "ACCOUNTANT"], "manage", "finance")).toBe(true);
    expect(can([], "view", "staff")).toBe(false);
  });
});

describe("rolesInScope – vai trò theo cơ sở đang chọn", () => {
  const grants = [
    { role: "TEACHER" as const, schoolId: A },
    { role: "ACCOUNTANT" as const, schoolId: B },
  ];

  it("chỉ tính vai trò của cơ sở đang chọn", () => {
    expect(rolesInScope(grants, A)).toEqual(["TEACHER"]);
    expect(rolesInScope(grants, B)).toEqual(["ACCOUNTANT"]);
    expect(can(rolesInScope(grants, A), "manage", "finance")).toBe(false);
    expect(can(rolesInScope(grants, B), "manage", "finance")).toBe(true);
  });

  it("vai trò cấp chuỗi áp dụng mọi cơ sở; 'Tất cả cơ sở' tính mọi vai trò", () => {
    expect(rolesInScope([{ role: "OWNER" }], A)).toEqual(["OWNER"]);
    expect(rolesInScope(grants, null)).toEqual(["TEACHER", "ACCOUNTANT"]);
  });
});
