import { describe, expect, it } from "vitest";
import { roleRowErrors, toAccountRoles } from "./roles";

describe("roleRowErrors", () => {
  it("kiểm tra phạm vi và dòng trùng", () => {
    expect(
      roleRowErrors([
        { role: "TEACHER", schoolId: "a" },
        { role: "PRINCIPAL", schoolId: "" },
        { role: "CHAIN_ADMIN", schoolId: "a" },
        { role: "ACCOUNTANT", schoolId: "" },
        { role: "TEACHER", schoolId: "a" },
        { role: "", schoolId: "" },
      ]),
    ).toEqual([
      null,
      "Chọn cơ sở cho vai trò này",
      "Vai trò này chỉ gán toàn chuỗi",
      null,
      "Trùng với dòng phía trên",
      "Chọn vai trò",
    ]);
  });
});

describe("toAccountRoles", () => {
  it("toàn chuỗi không gửi schoolId", () => {
    expect(toAccountRoles([{ role: "ACCOUNTANT", schoolId: "" }, { role: "NURSE", schoolId: "b" }])).toEqual([
      { role: "ACCOUNTANT", schoolId: undefined },
      { role: "NURSE", schoolId: "b" },
    ]);
  });
});
