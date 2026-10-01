import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, Pencil, Phone, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { ApiError } from "@/api";
import { useCan } from "@/hooks/useCan";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MARK_LABELS, useChild } from "@/api";
import { formatAge } from "@/features/school/age";
import { ChildSheet } from "@/features/school/ChildSheet";
import { ChildFeesTab } from "@/features/finance/ChildFeesTab";
import { ChildHealthTab } from "@/features/health/ChildHealthTab";
import { StaffAvatar } from "@/features/staff/StaffAvatar";

const MARK_DOT = { P: "bg-green-500", E: "bg-amber-400", A: "bg-red-500" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || "—"}</dd>
    </div>
  );
}

export default function ChildProfilePage() {
  const { id = "" } = useParams();
  const query = useChild(id);
  const canEdit = useCan("manage", "approvals");
  const canSeeFees = useCan("view", "finance");
  const [editing, setEditing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const canSeeHealth = useCan("view", "health");
  const requested = searchParams.get("tab");
  const tab = (canSeeFees && requested === "hoc-phi") || (canSeeHealth && requested === "suc-khoe") ? requested : "ho-so";
  const breadcrumbs = [{ label: "Hồ sơ trẻ", to: "/tre" }, { label: query.data?.fullName ?? "Chi tiết" }];

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div>
        <PageHeader title="Hồ sơ trẻ" breadcrumbs={breadcrumbs} />
        {notFound ? (
          <EmptyState icon={SearchX} title="Không tìm thấy hồ sơ" description="Hồ sơ không tồn tại hoặc thuộc cơ sở/lớp khác." />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }
  const child = query.data!;
  const { attendance } = child;
  const totalDays = attendance.present + attendance.excused + attendance.absent;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hồ sơ trẻ"
        breadcrumbs={breadcrumbs}
        actions={
          canEdit && (
            <Button variant="outline" className="min-h-11" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Sửa
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <StaffAvatar fullName={child.fullName} className="h-20 w-20 text-lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xl font-semibold">
              {child.fullName} <span className="font-normal text-muted-foreground">({child.nickname})</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {child.code} · {child.className} · {formatAge(child.dob)}
            </p>
            {child.allergies && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> {child.allergies}
              </Badge>
            )}
          </div>
          <Button asChild className="min-h-11">
            <a href={`tel:${child.guardianPhone}`}>
              <Phone className="w-4 h-4 mr-2" /> Gọi phụ huynh
            </a>
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === "ho-so" ? {} : { tab: v }, { replace: true })}>
        {(canSeeFees || canSeeHealth) && (
          <TabsList className="mb-4">
            <TabsTrigger value="ho-so" className="min-h-9">Hồ sơ</TabsTrigger>
            {canSeeHealth && <TabsTrigger value="suc-khoe" className="min-h-9">Sức khỏe</TabsTrigger>}
            {canSeeFees && <TabsTrigger value="hoc-phi" className="min-h-9">Học phí</TabsTrigger>}
          </TabsList>
        )}
        <TabsContent value="ho-so" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Thông tin</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row label="Ngày sinh">{formatDate(child.dob)}</Row>
                  <Row label="Giới tính">{child.gender === "MALE" ? "Nam" : "Nữ"}</Row>
                  <Row label="Cơ sở">{child.schoolName}</Row>
                  <Row label="Ngày nhập học">{formatDate(child.enrolledOn)}</Row>
                  <Row label="Phụ huynh">
                    {child.guardianName} ({child.guardianRelation})
                  </Row>
                  <Row label="Điện thoại">{child.guardianPhone}</Row>
                  <Row label="Địa chỉ">{child.address}</Row>
                  <Row label="Lưu ý sức khỏe">{child.healthNote}</Row>
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Đi học 30 ngày gần nhất</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(["present", "excused", "absent"] as const).map((k, i) => (
                      <div key={k} className="rounded-lg bg-muted p-2">
                        <p className="text-xl font-bold">{attendance[k]}</p>
                        <p className="text-xs text-muted-foreground">{MARK_LABELS[(["P", "E", "A"] as const)[i]]}</p>
                      </div>
                    ))}
                  </div>
                  {totalDays > 0 && (
                    <div className="flex flex-wrap gap-1" aria-label="Điểm danh gần đây">
                      {[...attendance.recent].reverse().map((r) => (
                        <span key={r.date} title={`${formatDate(r.date)}: ${MARK_LABELS[r.mark]}`} className={cn("h-4 w-4 rounded", MARK_DOT[r.mark])} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        {canSeeHealth && (
          <TabsContent value="suc-khoe" className="mt-0">
            <ChildHealthTab childId={child.id} />
          </TabsContent>
        )}
        {canSeeFees && (
          <TabsContent value="hoc-phi" className="mt-0">
            <ChildFeesTab childId={child.id} />
          </TabsContent>
        )}
      </Tabs>
      <ChildSheet open={editing} onOpenChange={setEditing} child={child} />
    </div>
  );
}
