import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import type { Province } from "@/data/addressDataLoader";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import type { ListParams } from "@/hooks/useListParams";
import type { StatusMeta } from "@/components/common/StatusBadge";

type S = components["schemas"];
export type ChangeRequestDto = S["ChangeRequestDto"];
export type ChangeRequestStatus = ChangeRequestDto["status"];
export type FieldChange = S["FieldChange"];

export const CHANGE_REQUEST_STATUS: Record<ChangeRequestStatus, StatusMeta> = {
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  APPROVED: { label: "Đã duyệt", tone: "success" },
  REJECTED: { label: "Từ chối", tone: "danger" },
};

export const CHANGE_KIND_LABELS: Record<ChangeRequestDto["kind"], string> = {
  CONTACT: "Liên hệ",
  BANK: "Tài khoản ngân hàng",
};

export const CHANGE_FIELD_LABELS: Record<string, string> = {
  phone: "Số điện thoại",
  permProvinceCode: "Tỉnh/thành (thường trú)",
  permWardCode: "Phường/xã (thường trú)",
  permAddressDetail: "Số nhà, đường (thường trú)",
  currProvinceCode: "Tỉnh/thành (hiện tại)",
  currWardCode: "Phường/xã (hiện tại)",
  currAddressDetail: "Số nhà, đường (hiện tại)",
  bankName: "Ngân hàng",
  bankAccountNo: "Số tài khoản",
  bankAccountHolder: "Chủ tài khoản",
};

/** Giá trị hiển thị: mã tỉnh/phường đổi thành tên; rỗng hiện "(trống)". */
export function changeValue(field: string, value: string | null | undefined, provinces: readonly Province[]): string {
  if (!value) return "(trống)";
  if (field.endsWith("ProvinceCode")) return provinces.find((p) => p.province_code === value)?.name ?? value;
  if (field.endsWith("WardCode")) {
    for (const p of provinces) {
      const ward = p.wards.find((w) => w.ward_code === value);
      if (ward) return ward.name;
    }
  }
  return value;
}

/** Dòng "Trường: cũ → mới" của một đề xuất. */
export function describeChanges(changes: readonly FieldChange[], provinces: readonly Province[]): string[] {
  return changes.map(
    (c) =>
      `${CHANGE_FIELD_LABELS[c.field] ?? c.field}: ${changeValue(c.field, c.from, provinces)} → ${changeValue(c.field, c.to, provinces)}`,
  );
}

export function useMyChangeRequests() {
  return useQuery({
    queryKey: ["me", "change-requests"],
    queryFn: async () => unwrap(await api.GET("/api/v1/me/change-requests")),
  });
}

export async function submitChangeRequest(changes: Record<string, string>) {
  return unwrap(await api.POST("/api/v1/me/change-requests", { body: { changes } }));
}

/** Bộ lọc trạng thái trên URL; không có = chờ duyệt. */
export const REVIEW_FILTER_KEYS = ["status"] as const;
export const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export function useChangeRequests(params: ListParams) {
  const { queryKey } = useCurrentSchool();
  const { page, size, status } = params.apiParams as Record<string, string | number | undefined>;
  const query = {
    page: page as number,
    size: size as number,
    status: status === "ALL" ? undefined : ((status as ChangeRequestStatus | undefined) ?? "PENDING"),
  };
  return useQuery({
    queryKey: queryKey("staff", "change-requests", query),
    queryFn: async () => unwrap(await api.GET("/api/v1/staff/change-requests", { params: { query } })),
    placeholderData: keepPreviousData,
  });
}
