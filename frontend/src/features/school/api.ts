import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";
import type {
  AgeGroup,
  ApprovalItem,
  ApprovalType,
  ChildDetail,
  ChildFields,
  ChildItem,
  ChildMark,
  ClassItem,
  Page,
  RollCall,
  TodaySummary,
} from "@/mock/types";

export type { ApprovalItem, ApprovalType, ChildDetail, ChildFields, ChildItem, ChildMark, ClassItem, RollCall, TodaySummary };

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  NHA_TRE: "Nhà trẻ (24–36 tháng)",
  MAM: "Mẫu giáo bé (3–4 tuổi)",
  CHOI: "Mẫu giáo nhỡ (4–5 tuổi)",
  LA: "Mẫu giáo lớn (5–6 tuổi)",
};

export const MARK_LABELS: Record<ChildMark, string> = { P: "Có mặt", E: "Vắng có phép", A: "Vắng không phép" };

export function useToday() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("today"), queryFn: () => apiRequest<TodaySummary>("GET", "/today") });
}

export function assignSubstitute(body: { classId: string; absentStaffId: string; staffId: string }) {
  return apiRequest<void>("POST", "/substitutions", { body });
}

export function useApprovals() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("approvals"), queryFn: () => apiRequest<ApprovalItem[]>("GET", "/approvals") });
}

export function decideApproval(item: Pick<ApprovalItem, "type" | "id">, approve: boolean, note?: string) {
  return apiRequest<void>("POST", `/approvals/${item.type}/${item.id}/${approve ? "approve" : "reject"}`, { body: { note } });
}

export function useClasses() {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("classes"), queryFn: () => apiRequest<ClassItem[]>("GET", "/classes") });
}

export const CHILD_FILTER_KEYS = ["classId", "gender"] as const;

export function useChildren(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const query = params.apiParams as Record<string, string | number | undefined>;
  return useQuery({
    queryKey: queryKey("children", "list", query),
    queryFn: () => apiRequest<Page<ChildItem>>("GET", "/children", { query }),
    placeholderData: keepPreviousData,
  });
}

export function useChild(id: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({ queryKey: queryKey("children", id), queryFn: () => apiRequest<ChildDetail>("GET", `/children/${id}`) });
}

export function saveChild(id: string | null, body: ChildFields) {
  return id ? apiRequest<ChildItem>("PUT", `/children/${id}`, { body }) : apiRequest<ChildItem>("POST", "/children", { body });
}

export function useRollCall(classId: string | undefined, date: string) {
  const { queryKey } = useCurrentSchool();
  return useQuery({
    queryKey: queryKey("roll-call", classId, date),
    queryFn: () => apiRequest<RollCall>("GET", "/roll-call", { query: { classId, date } }),
    enabled: !!classId,
  });
}

export function saveRollCall(body: { classId: string; date: string; rows: { childId: string; mark: ChildMark | null; note?: string }[] }) {
  return apiRequest<void>("PUT", "/roll-call", { body });
}
