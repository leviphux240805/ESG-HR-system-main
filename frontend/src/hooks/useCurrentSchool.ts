import { useCallback, useMemo } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Query key có kèm cơ sở đang chọn: đổi cơ sở trên header thì key đổi và TanStack Query tự tải lại.
 * Mọi query dữ liệu nghiệp vụ phải dùng key này.
 */
export function schoolQueryKey(schoolId: string | null, ...parts: readonly unknown[]): QueryKey {
  return [...parts, { schoolId: schoolId ?? "ALL" }];
}

/** Trường đang chọn trên header và các thao tác liên quan. */
export function useCurrentSchool() {
  const { me, selectedSchoolId, selectSchool } = useAuth();
  const schools = useMemo(() => me?.schools ?? [], [me]);
  const canChooseAll = schools.length > 1;

  const queryKey = useCallback(
    (...parts: readonly unknown[]) => schoolQueryKey(selectedSchoolId, ...parts),
    [selectedSchoolId],
  );

  return {
    /** null = "Tất cả trường" được gán. */
    schoolId: selectedSchoolId,
    school: schools.find((s) => s.id === selectedSchoolId) ?? null,
    schools,
    isAllSchools: selectedSchoolId === null,
    canChooseAll,
    /** Không đổi được trường (chỉ có một trường). */
    locked: !canChooseAll && schools.length <= 1,
    select: selectSchool,
    queryKey,
  };
}
