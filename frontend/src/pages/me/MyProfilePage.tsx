import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, PhoneCall, UserX } from "lucide-react";
import { useMyStaff } from "@/api";
import { ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { useAddressData } from "@/features/staff/AddressFields";
import { CHANGE_KIND_LABELS, CHANGE_REQUEST_STATUS, describeChanges } from "@/features/staff/changeRequests";
import { useMyChangeRequests } from "@/api";
import { BankRequestSheet, ContactRequestSheet } from "@/features/staff/profile/ChangeRequestSheets";
import { ProfileHeader, ProfileTabs } from "@/features/staff/profile/ProfileView";

function MyRequests() {
  const requests = useMyChangeRequests();
  const provinces = useAddressData();
  if (!requests.data?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Đề xuất cập nhật của tôi</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y" aria-label="Đề xuất cập nhật của tôi">
          {requests.data.map((r) => (
            <li key={r.id} className="py-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{CHANGE_KIND_LABELS[r.kind]}</span>
                <StatusBadge status={r.status} labels={CHANGE_REQUEST_STATUS} />
                <span className="text-xs text-muted-foreground">gửi {formatDateTime(r.createdAt)}</span>
              </div>
              <ul className="text-sm text-muted-foreground list-disc ml-5">
                {describeChanges(r.changes, provinces).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {r.reviewedAt && (
                <p className="text-sm">
                  {r.reviewerName ?? "Người duyệt"} · {formatDateTime(r.reviewedAt)}
                  {r.reviewNote ? `: ${r.reviewNote}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Hồ sơ nhân viên của người đang đăng nhập (chỉ xem); sửa SĐT/địa chỉ/ngân hàng bằng đề xuất chờ duyệt. */
export default function MyProfilePage() {
  const profile = useMyStaff();
  const [sheet, setSheet] = useState<"contact" | "bank" | null>(null);

  if (profile.isLoading) return <PageSkeleton />;
  if (profile.isError) {
    const notLinked = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <div>
        <PageHeader title="Hồ sơ của tôi" />
        {notLinked ? (
          <EmptyState
            icon={UserX}
            title="Tài khoản chưa gắn hồ sơ nhân viên"
            description="Liên hệ văn phòng điều hành để gắn tài khoản với hồ sơ nhân sự của bạn."
          />
        ) : (
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        )}
      </div>
    );
  }

  const staff = profile.data!;
  const active = staff.status === "ACTIVE";
  return (
    <div className="space-y-4">
      <PageHeader
        title="Hồ sơ của tôi"
        description="Thông tin do nhà trường quản lý. Cần sửa số điện thoại, địa chỉ hoặc tài khoản ngân hàng thì gửi đề xuất."
        actions={
          active && (
            <>
              <Button variant="outline" className="min-h-11" onClick={() => setSheet("contact")}>
                <PhoneCall className="w-4 h-4 mr-2" /> Đổi SĐT, địa chỉ
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setSheet("bank")}>
                <Landmark className="w-4 h-4 mr-2" /> Đổi tài khoản ngân hàng
              </Button>
            </>
          )
        }
      />
      <ProfileHeader staff={staff} />
      <MyRequests />
      <ProfileTabs staff={staff} exclude={["classes", "history"]} />
      <ContactRequestSheet staff={staff} open={sheet === "contact"} onOpenChange={(o) => !o && setSheet(null)} />
      <BankRequestSheet staff={staff} open={sheet === "bank"} onOpenChange={(o) => !o && setSheet(null)} />
    </div>
  );
}
