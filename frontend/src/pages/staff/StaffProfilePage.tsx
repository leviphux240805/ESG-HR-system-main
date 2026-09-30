import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Camera, Loader2, SearchX, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ApiError, errorMessage } from "@/api/errors";
import { uploadFile, validateFile } from "@/api/files";
import { formatDate } from "@/lib/format";
import { type StaffDetail, updateStaff, useStaffDetail } from "@/features/staff/api";
import { POSITION_LABELS, STAFF_STATUS } from "@/features/staff/labels";
import { StaffAvatar } from "@/features/staff/StaffAvatar";
import { fromStaffDetail, toStaffFields } from "@/features/staff/staffForm";
import { InfoTab } from "@/features/staff/profile/InfoTab";
import { ContractsTab } from "@/features/staff/profile/ContractsTab";
import { DocumentsTab } from "@/features/staff/profile/DocumentsTab";
import { HistoryTab } from "@/features/staff/profile/HistoryTab";
import { SalaryTab } from "@/features/staff/profile/SalaryTab";
import { InsuranceTab } from "@/features/staff/profile/InsuranceTab";
import { QualificationsTab } from "@/features/staff/profile/QualificationsTab";
import { TerminateSheet, TransferSheet } from "@/features/staff/profile/LifecycleSheets";

function ClassesTab() {
  return (
    <EmptyState
      icon={Users}
      title="Chưa có phân công lớp"
      description="Phân công giáo viên, bảo mẫu phụ trách lớp có từ giai đoạn Lớp học & trẻ."
    />
  );
}

/**
 * Tab của hồ sơ; khóa là giá trị `?tab=` (trang giấy tờ hết hạn liên kết tới contracts, qualifications,
 * documents). Tab lương chỉ có với người được xem lương (hiệu trưởng không thấy).
 */
const TABS: { value: string; label: string; Component: (props: { staff: StaffDetail }) => JSX.Element; visible?: (s: StaffDetail) => boolean }[] = [
  { value: "info", label: "Thông tin cá nhân", Component: InfoTab },
  { value: "contracts", label: "Hợp đồng & quyết định", Component: ContractsTab },
  { value: "salary", label: "Lương & phụ cấp", Component: SalaryTab, visible: (s) => s.permissions.canViewSalary },
  { value: "insurance", label: "Bảo hiểm & thuế", Component: InsuranceTab },
  { value: "qualifications", label: "Trình độ", Component: QualificationsTab },
  { value: "documents", label: "Giấy tờ", Component: DocumentsTab },
  { value: "classes", label: "Phân công lớp", Component: ClassesTab },
  { value: "history", label: "Lịch sử", Component: HistoryTab },
];

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function PhotoButton({ staff }: { staff: StaffDetail }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const change = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Ảnh đại diện phải là JPG, PNG hoặc WEBP.");
    const problem = validateFile(file, 5);
    if (problem) return void toast.error(problem);
    setBusy(true);
    try {
      const stored = await uploadFile(file, staff.schoolId);
      await updateStaff(staff.id, toStaffFields(fromStaffDetail(staff), stored.id));
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Đã đổi ảnh đại diện.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => change(e.target.files?.[0])} data-testid="photo-input" />
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full shadow"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Đổi ảnh đại diện"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      </Button>
    </>
  );
}

function ProfileHeader({ staff }: { staff: StaffDetail }) {
  const canEdit = staff.permissions.canEdit && staff.status === "ACTIVE";
  return (
    <Card className="mb-4">
      <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative w-fit">
          <StaffAvatar fullName={staff.fullName} photoUrl={staff.photoUrl} className="h-20 w-20 text-lg" />
          {canEdit && <PhotoButton staff={staff} />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{staff.fullName}</h2>
            <StatusBadge status={staff.status} labels={STAFF_STATUS} />
          </div>
          <p className="text-sm text-muted-foreground">
            {staff.staffCode} · {POSITION_LABELS[staff.position]} · {staff.schoolName}
          </p>
          <p className="text-sm text-muted-foreground">
            Vào làm {formatDate(staff.startDate)}
            {staff.endDate ? ` · Nghỉ việc ${formatDate(staff.endDate)}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffProfilePage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const detail = useStaffDetail(id);
  const [sheet, setSheet] = useState<"transfer" | "terminate" | null>(null);
  const tabs = detail.data ? TABS.filter((t) => !t.visible || t.visible(detail.data)) : TABS;
  const tabParam = searchParams.get("tab");
  const tab = tabs.some((t) => t.value === tabParam) ? tabParam! : "info";

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "info") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

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
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="w-max">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="min-h-9">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map(({ value, Component }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {tab === value && <Component staff={staff} />}
          </TabsContent>
        ))}
      </Tabs>
      <TransferSheet staff={staff} open={sheet === "transfer"} onOpenChange={(o) => !o && setSheet(null)} />
      <TerminateSheet staff={staff} open={sheet === "terminate"} onOpenChange={(o) => !o && setSheet(null)} />
    </div>
  );
}
