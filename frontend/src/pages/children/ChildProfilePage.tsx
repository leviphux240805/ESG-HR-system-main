import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Pencil, Phone, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { ApiError } from "@/api";
import { useCan } from "@/hooks/useCan";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MARK_LABELS, useChild } from "@/api";
import { formatAge } from "@/features/school/age";
import { ChildSheet } from "@/features/school/ChildSheet";
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cân đo gần nhất</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {child.latestMeasurement ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span>
                    Chiều cao <b>{child.latestMeasurement.heightCm} cm</b>
                  </span>
                  <span>
                    Cân nặng <b>{child.latestMeasurement.weightKg} kg</b>
                  </span>
                  <span className="text-muted-foreground">{formatDate(child.latestMeasurement.date)}</span>
                  {child.latestMeasurement.status.map((s) => (
                    <Badge key={s} variant={s === "Bình thường" ? "secondary" : "destructive"}>
                      {s}
                    </Badge>
                  ))}
                  <Link to={`/can-do/${child.id}`} className="text-primary hover:underline">
                    Biểu đồ tăng trưởng →
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground">Chưa có số đo.</p>
              )}
            </CardContent>
          </Card>

          {canSeeFees && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Học phí</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {child.balance > 0 ? (
                  <p>
                    Còn nợ <b className="text-destructive">{formatMoney(child.balance)}</b>
                  </p>
                ) : (
                  <p className="text-green-700">Đã đóng đủ học phí.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ChildSheet open={editing} onOpenChange={setEditing} child={child} />
    </div>
  );
}
