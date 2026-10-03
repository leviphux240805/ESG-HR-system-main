export interface HierarchySchool {
  id: string;
  code: string;
  name: string;
  type: "MAIN" | "BRANCH";
  parentId?: string;
}

export function groupSchools<T extends HierarchySchool>(schools: readonly T[]) {
  const byId = new Map(schools.map((school) => [school.id, school]));
  const roots = schools
    .filter((school) => school.type === "MAIN" || !school.parentId || !byId.has(school.parentId))
    .sort((a, b) => Number(a.type === "BRANCH") - Number(b.type === "BRANCH") || a.code.localeCompare(b.code));

  return roots.map((school) => ({
    school,
    branches: schools
      .filter((branch) => branch.type === "BRANCH" && branch.parentId === school.id)
      .sort((a, b) => a.code.localeCompare(b.code)),
  }));
}