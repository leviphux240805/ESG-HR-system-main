import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCan } from "./useCan";
import { schoolQueryKey } from "./useCurrentSchool";

const auth = vi.hoisted(() => ({
  me: {
    roles: [
      { role: "VICE_PRINCIPAL", schoolId: "a", functionGroups: ["HR"] },
      { role: "ACCOUNTANT", schoolId: "b" },
    ],
  },
  selectedSchoolId: "a" as string | null,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

describe("useCan", () => {
  it("xét quyền theo vai trò và nhóm chức năng của trường đang chọn", () => {
    auth.selectedSchoolId = "a";
    expect(renderHook(() => useCan("approve", "attendance")).result.current).toBe(true);
    expect(renderHook(() => useCan("manage", "payroll")).result.current).toBe(false);

    auth.selectedSchoolId = "b";
    expect(renderHook(() => useCan("manage", "payroll")).result.current).toBe(true);
    expect(renderHook(() => useCan("approve", "attendance")).result.current).toBe(false);
  });
});

describe("schoolQueryKey", () => {
  it("đưa trường đang chọn vào query key để đổi trường thì tải lại", () => {
    expect(schoolQueryKey("a", "staff", { page: 1 })).toEqual(["staff", { page: 1 }, { schoolId: "a" }]);
    expect(schoolQueryKey(null, "staff")).toEqual(["staff", { schoolId: "ALL" }]);
  });
});
