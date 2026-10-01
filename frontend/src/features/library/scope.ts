import type { FolderDto, LibraryRole } from "@/api";

interface Grant {
  role: LibraryRole;
  schoolId: string;
  functionGroups?: readonly string[];
}

interface School {
  id: string;
  name: string;
}

/** Phạm vi ban hành: null = cả tổ chức, còn lại là id trường. */
export interface PublishScope {
  schoolId: string | null;
  label: string;
}

export const CHAIN_LABEL = "Cả tổ chức";

/**
 * Phạm vi người dùng được ban hành văn bản (chỉ để ẩn/hiện; backend kiểm tra lại): hiệu trưởng cho cả tổ chức và
 * trường mình; phó hiệu trưởng nhóm Nhân sự, kế toán cho trường được gán.
 */
export function publishScopes(grants: readonly Grant[], schools: readonly School[]): PublishScope[] {
  const principal = grants.some((g) => g.role === "PRINCIPAL");
  const result: PublishScope[] = principal ? [{ schoolId: null, label: CHAIN_LABEL }] : [];
  for (const school of schools) {
    const allowed = grants.some(
      (g) =>
        g.schoolId === school.id &&
        (g.role === "PRINCIPAL" || g.role === "ACCOUNTANT" || (g.role === "VICE_PRINCIPAL" && !!g.functionGroups?.includes("HR"))),
    );
    if (allowed) result.push({ schoolId: school.id, label: school.name });
  }
  return result;
}

export interface FolderNode extends FolderDto {
  children: FolderNode[];
  depth: number;
}

export interface FolderGroup {
  schoolId: string | null;
  label: string;
  roots: FolderNode[];
}

/** Dựng cây thư mục theo nhóm (cả tổ chức trước, rồi từng cơ sở theo tên); cha không thấy thì thành gốc. */
export function buildFolderGroups(folders: readonly FolderDto[], schools: readonly School[]): FolderGroup[] {
  const nodes = new Map<string, FolderNode>(folders.map((f) => [f.id, { ...f, children: [], depth: 0 }]));
  const groups = new Map<string, FolderGroup>();
  const groupOf = (schoolId: string | null) => {
    const key = schoolId ?? "";
    let group = groups.get(key);
    if (!group) {
      const label = schoolId ? (schools.find((s) => s.id === schoolId)?.name ?? "Cơ sở khác") : CHAIN_LABEL;
      group = { schoolId, label, roots: [] };
      groups.set(key, group);
    }
    return group;
  };
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else groupOf(node.schoolId ?? null).roots.push(node);
  }
  const sortAndDepth = (list: FolderNode[], depth: number) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    for (const n of list) {
      n.depth = depth;
      sortAndDepth(n.children, depth + 1);
    }
  };
  const result = [...groups.values()];
  result.forEach((g) => sortAndDepth(g.roots, 0));
  return result.sort((a, b) => {
    if (a.schoolId === null) return -1;
    if (b.schoolId === null) return 1;
    return a.label.localeCompare(b.label, "vi");
  });
}

/** Thư mục chọn được khi ban hành: thư mục chung dùng cho mọi phạm vi; thư mục cơ sở chỉ cho đúng cơ sở. */
export function foldersForScope(folders: readonly FolderDto[], schoolId: string | null): FolderDto[] {
  return folders.filter((f) => f.canManage && (!f.schoolId || f.schoolId === schoolId));
}

/** Tên phạm vi hiển thị. */
export function scopeLabel(schoolName: string | null | undefined): string {
  return schoolName ?? CHAIN_LABEL;
}
