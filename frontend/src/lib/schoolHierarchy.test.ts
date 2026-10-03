import { describe, expect, it } from "vitest";
import { groupSchools } from "./schoolHierarchy";

describe("groupSchools", () => {
  it("nests branches below their main school, preserving unparented schools", () => {
    const schools = [
      { id: "branch-2", code: "PBC-PH2", name: "Phân hiệu 2", type: "BRANCH" as const, parentId: "main" },
      { id: "other", code: "OTHER", name: "Trường khác", type: "MAIN" as const },
      { id: "main", code: "PBC", name: "Phan Bội Châu", type: "MAIN" as const },
      { id: "branch-1", code: "PBC-PH1", name: "Phân hiệu 1", type: "BRANCH" as const, parentId: "main" },
      { id: "orphan", code: "ORPHAN", name: "Phân hiệu ngoài phạm vi", type: "BRANCH" as const, parentId: "missing" },
    ];

    expect(groupSchools(schools).map(({ school, branches }) => [school.id, branches.map((branch) => branch.id)])).toEqual([
      ["other", []],
      ["main", ["branch-1", "branch-2"]],
      ["orphan", []],
    ]);
  });
});