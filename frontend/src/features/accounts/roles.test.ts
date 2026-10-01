import { describe, expect, it } from "vitest";
import { roleRowErrors, toAccountRoles } from "./roles";

describe("roleRowErrors", () => {
  it("bắt buộc trường, nhóm chức năng cho phó hiệu trưởng, không trùng dòng", () => {
    expect(
      roleRowErrors([
        { role: "TEACHER", schoolId: "a", functionGroups: [] },
        { role: "NURSE", schoolId: "", functionGroups: [] },
        { role: "VICE_PRINCIPAL", schoolId: "a", functionGroups: [] },
        { role: "VICE_PRINCIPAL", schoolId: "b", functionGroups: ["HR"] },
        { role: "TEACHER", schoolId: "a", functionGroups: [] },
        { role: "", schoolId: "", functionGroups: [] },
      ]),
    ).toEqual([
      null,
      "Chọn trường cho vai trò này",
      "Chọn ít nhất một nhóm chức năng",
      null,
      "Trùng với dòng phía trên",
      "Chọn vai trò",
    ]);
  });
});

describe("toAccountRoles", () => {
  it("chỉ phó hiệu trưởng gửi nhóm chức năng", () => {
    expect(
      toAccountRoles([
        { role: "VICE_PRINCIPAL", schoolId: "a", functionGroups: ["HR", "REPORTS"] },
        { role: "NURSE", schoolId: "b", functionGroups: ["HR"] },
      ]),
    ).toEqual([
      { role: "VICE_PRINCIPAL", schoolId: "a", functionGroups: ["HR", "REPORTS"] },
      { role: "NURSE", schoolId: "b", functionGroups: undefined },
    ]);
  });
});
