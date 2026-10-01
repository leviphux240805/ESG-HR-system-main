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
import { CHILD_STATUS, useChild } from "@/api";
import { StatusBadge } from "@/components/common/StatusBadge";
import { addressText, useAddressData } from "@/features/staff/AddressFields";
import { formatAge } from "@/features/school/age";
import { ChildSheet } from "@/features/school/ChildSheet";
import { ChildFeesTab } from "@/features/finance/ChildFeesTab";
import { ChildHealthTab } from "@/features/health/ChildHealthTab";
import { StaffAvatar } from "@/features/staff/StaffAvatar";

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
  const provinces = useAddressData();
  const canSeeFees = useCan("view", "finance");
  const [editing, setEditing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const canSeeHealth = useCan("view", "health");
  const requested = searchParams.get("tab");
  const tab = (canSeeFees && requested === "hoc-phi") || (canSeeHealth && requested === "suc-khoe") ? requested : "ho-so";
  const breadcrumbs = [{ label: "Hồ sơ trẻ", to: "/tre" }, { label: query.data?.item.fullName ?? "Chi tiết" }];

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
  const detail = query.data!;
  const child = detail.item;
  const primary = detail.guardians.find((g) => g.primary) ?? detail.guardians[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hồ sơ trẻ"
        breadcrumbs={breadcrumbs}
        actions={
          detail.canEdit && (
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
              {child.fullName} {child.nickname && <span className="font-normal text-muted-foreground">({child.nickname})</span>}
            </h2>
            <p className="text-sm text-muted-foreground">{[child.code, child.className, formatAge(child.dob)].filter(Boolean).join(" · ")}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={child.status} labels={CHILD_STATUS} />
              {child.allergyNote && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> {child.allergyNote}
                </Badge>
              )}
            </div>
          </div>
          {primary?.phone && (
            <Button asChild className="min-h-11">
              <a href={`tel:${primary.phone}`}>
                <Phone className="w-4 h-4 mr-2" /> Gọi phụ huynh
              </a>
            </Button>
          )}
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
                  <Row label="Ngày nhập học">{formatDate(detail.enrolledAt)}</Row>
                  <Row label="Địa chỉ">{addressText(provinces, detail.provinceCode, detail.wardCode, detail.addressDetail)}</Row>
                  <Row label="Lưu ý sức khỏe">{detail.healthNote}</Row>
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Phụ huynh, người đón</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.guardians.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có thông tin phụ huynh.</p>
                  ) : (
                    <ul className="divide-y">
                      {detail.guardians.map((g) => (
                        <li key={g.id} className="flex min-h-11 items-center gap-2 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {g.fullName} <span className="font-normal text-muted-foreground">({g.relationship})</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[g.primary && "Liên hệ chính", g.canPickUp && "Được đón trẻ"].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {g.phone && (
                            <a href={`tel:${g.phone}`} className="text-primary">
                              {g.phone}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quá trình học</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {detail.enrollments.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span>{e.className}</span>
                        <span className="text-muted-foreground">
                          {formatDate(e.fromDate)} – {e.toDate ? formatDate(e.toDate) : "nay"}
                        </span>
                      </li>
                    ))}
                  </ul>
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
      <ChildSheet open={editing} onOpenChange={setEditing} child={detail} />
    </div>
  );
}
