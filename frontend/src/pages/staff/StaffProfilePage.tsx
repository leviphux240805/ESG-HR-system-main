import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftRight, SearchX, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { ApiError } from "@/api";
import { useStaffDetail } from "@/api";
import { TerminateSheet, TransferSheet } from "@/features/staff/profile/LifecycleSheets";
import { ProfileHeader, ProfileTabs } from "@/features/staff/profile/ProfileView";

export default function StaffProfilePage() {
  const { id = "" } = useParams();
  const detail = useStaffDetail(id);
  const [sheet, setSheet] = useState<"transfer" | "terminate" | null>(null);
  const breadcrumbs = [{ label: "Nhân sự", to: "/nhan-su" }, { label: detail.data?.fullName ?? "Hồ sơ nhân viên" }];

  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && (detail.error.status === 404 || detail.error.status === 403);
    return (
      <div>
        <PageHeader title="Hồ sơ nhân viên" breadcrumbs={breadcrumbs} />
        {notFound ? (
          <EmptyState
            icon={SearchX}
            title="Không tìm thấy hồ sơ"
            description="Hồ sơ không tồn tại, hoặc thuộc cơ sở khác với cơ sở đang chọn trên đầu trang."
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/nhan-su">Về danh sách nhân sự</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        )}
      </div>
    );
  }

  const staff = detail.data!;
  const active = staff.status === "ACTIVE";
  return (
    <div>
      <PageHeader
        title="Hồ sơ nhân viên"
        breadcrumbs={breadcrumbs}
        actions={
          <>
            {active && staff.permissions.canTransfer && (
              <Button variant="outline" className="min-h-11" onClick={() => setSheet("transfer")}>
                <ArrowLeftRight className="w-4 h-4 mr-2" /> Điều chuyển
              </Button>
            )}
            {active && staff.permissions.canTerminate && (
              <Button variant="outline" className="min-h-11 text-destructive hover:text-destructive" onClick={() => setSheet("terminate")}>
                <UserX className="w-4 h-4 mr-2" /> Cho nghỉ việc
              </Button>
            )}
          </>
        }
      />
      <ProfileHeader staff={staff} />
      <ProfileTabs staff={staff} />
      <TransferSheet staff={staff} open={sheet === "transfer"} onOpenChange={(o) => !o && setSheet(null)} />
      <TerminateSheet staff={staff} open={sheet === "terminate"} onOpenChange={(o) => !o && setSheet(null)} />
    </div>
  );
}
