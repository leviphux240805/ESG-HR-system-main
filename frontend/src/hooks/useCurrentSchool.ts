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

/** Cơ sở đang chọn trên header và các thao tác liên quan. */
export function useCurrentSchool() {
  const { me, selectedSchoolId, selectSchool } = useAuth();
  const schools = useMemo(() => me?.schools ?? [], [me]);
  const canChooseAll = !!me?.chainWide;

  const queryKey = useCallback(
    (...parts: readonly unknown[]) => schoolQueryKey(selectedSchoolId, ...parts),
    [selectedSchoolId],
  );

  return {
    /** null = "Tất cả cơ sở" (chỉ vai trò cấp chuỗi). */
    schoolId: selectedSchoolId,
    school: schools.find((s) => s.id === selectedSchoolId) ?? null,
    schools,
    isAllSchools: selectedSchoolId === null,
    canChooseAll,
    /** Không đổi được cơ sở (chỉ có một cơ sở, không có vai trò cấp chuỗi). */
    locked: !canChooseAll && schools.length <= 1,
    select: selectSchool,
    queryKey,
  };
}
