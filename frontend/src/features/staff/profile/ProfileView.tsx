import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { errorMessage } from "@/api/errors";
import { uploadFile, validateFile } from "@/api/files";
import { formatDate } from "@/lib/format";
import { useClasses } from "@/features/school/api";
import { type StaffDetail, updateStaff } from "../api";
import { POSITION_LABELS, STAFF_STATUS } from "../labels";
import { StaffAvatar } from "../StaffAvatar";
import { fromStaffDetail, toStaffFields } from "../staffForm";
import { InfoTab } from "./InfoTab";
import { ContractsTab } from "./ContractsTab";
import { DocumentsTab } from "./DocumentsTab";
import { HistoryTab } from "./HistoryTab";
import { SalaryTab } from "./SalaryTab";
import { InsuranceTab } from "./InsuranceTab";
import { QualificationsTab } from "./QualificationsTab";

function ClassesTab({ staff }: { staff: StaffDetail }) {
  const classes = useClasses();
  const mine = (classes.data ?? []).filter((c) => c.teachers.some((t) => t.id === staff.id));
  if (mine.length === 0) {
    return <EmptyState icon={Users} title="Chưa có phân công lớp" description="Giáo viên được phân công phụ trách lớp sẽ hiện ở đây." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {mine.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4">
            <Link to={`/tre?classId=${c.id}`} className="font-medium hover:underline">
              {c.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              Sĩ số {c.size} · Cùng lớp: {c.teachers.filter((t) => t.id !== staff.id).map((t) => t.fullName).join(", ") || "—"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
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

export function ProfileHeader({ staff }: { staff: StaffDetail }) {
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

/** Các tab hồ sơ, tab đang mở nằm trên URL (`?tab=`); `exclude` bỏ bớt tab (trang "Hồ sơ của tôi"). */
export function ProfileTabs({ staff, exclude = [] }: { staff: StaffDetail; exclude?: string[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((t) => !exclude.includes(t.value) && (!t.visible || t.visible(staff)));
  const tabParam = searchParams.get("tab");
  const tab = tabs.some((t) => t.value === tabParam) ? tabParam! : "info";

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "info") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
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
  );
}
