import { describe, expect, it } from "vitest";
import type { FolderDto } from "@/api";
import { buildFolderGroups, foldersForScope, publishScopes } from "./scope";

const schools = [
  { id: "a", name: "Trường A" },
  { id: "b", name: "Trường B" },
];

describe("publishScopes", () => {
  it("hiệu trưởng: cả tổ chức và trường mình", () => {
    expect(publishScopes([{ role: "PRINCIPAL", schoolId: "a" }, { role: "PRINCIPAL", schoolId: "b" }], schools).map((s) => s.schoolId)).toEqual([
      null,
      "a",
      "b",
    ]);
    expect(publishScopes([{ role: "PRINCIPAL", schoolId: "a" }], schools).map((s) => s.schoolId)).toEqual([null, "a"]);
  });

  it("phó hiệu trưởng nhóm Nhân sự chỉ trường mình; giáo viên không có", () => {
    expect(publishScopes([{ role: "VICE_PRINCIPAL", schoolId: "a", functionGroups: ["HR"] }], schools).map((s) => s.schoolId)).toEqual(["a"]);
    expect(publishScopes([{ role: "VICE_PRINCIPAL", schoolId: "a", functionGroups: ["CLASSROOM"] }], schools)).toEqual([]);
    expect(publishScopes([{ role: "TEACHER", schoolId: "a" }], schools)).toEqual([]);
  });
});

const folder = (id: string, name: string, schoolId?: string, parentId?: string, canManage = true): FolderDto => ({
  id,
  name,
  schoolId,
  parentId,
  canManage,
});

describe("buildFolderGroups", () => {
  it("nhóm cả tổ chức trước, lồng thư mục con, sắp theo tên", () => {
    const groups = buildFolderGroups(
      [folder("2", "Quy chế", "b"), folder("1", "Nội quy"), folder("3", "Biểu mẫu"), folder("4", "Con", undefined, "1")],
      schools,
    );
    expect(groups.map((g) => g.label)).toEqual(["Cả tổ chức", "Trường B"]);
    expect(groups[0].roots.map((r) => r.name)).toEqual(["Biểu mẫu", "Nội quy"]);
    expect(groups[0].roots[1].children[0]).toMatchObject({ name: "Con", depth: 1 });
  });
});

describe("foldersForScope", () => {
  it("thư mục chung dùng cho mọi phạm vi, thư mục cơ sở chỉ đúng cơ sở", () => {
    const list = [folder("1", "Chung"), folder("2", "A", "a"), folder("3", "B", "b"), folder("4", "A khóa", "a", undefined, false)];
    expect(foldersForScope(list, "a").map((f) => f.id)).toEqual(["1", "2"]);
    expect(foldersForScope(list, null).map((f) => f.id)).toEqual(["1"]);
  });
});
