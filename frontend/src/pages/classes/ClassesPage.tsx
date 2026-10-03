import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { useClasses } from "@/api";
import { useCan } from "@/hooks/useCan";

/** Danh sách lớp của cơ sở: sĩ số, giáo viên, có mặt hôm nay. */
export default function ClassesPage() {
  const query = useClasses();
  const canViewChildren = useCan("view", "children");

  return (
    <div>
      <PageHeader title="Lớp học" description="Sĩ số, giáo viên phụ trách và tình hình đi học hôm nay." />
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState icon={School} title="Chưa có lớp" description="Lớp của cơ sở sẽ hiện ở đây." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {query.data.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <p className="text-lg font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[c.ageGroupName, c.room].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Sĩ số</span>
                    <span className="font-medium">
                      {c.size}/{c.capacity}
                    </span>
                  </div>
                  <Progress value={c.capacity ? (c.size / c.capacity) * 100 : 0} className="mt-1 h-2" aria-label={`Sĩ số lớp ${c.name}`} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.boys} bé trai · {c.girls} bé gái
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground">Giáo viên</p>
                  {c.teachers.length ? c.teachers.map((t) => <p key={t.id}>{t.fullName}</p>) : <p className="text-muted-foreground">Chưa phân công</p>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {c.presentToday == null ? (
                    <Badge variant="outline">Chưa điểm danh</Badge>
                  ) : (
                    <Badge variant="secondary">Hôm nay có mặt {c.presentToday}</Badge>
                  )}
                </div>
                {canViewChildren && (
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="min-h-11 flex-1">
                    <Link to={`/tre?classId=${c.id}`}>
                      Danh sách trẻ <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="min-h-11" aria-label={`Điểm danh lớp ${c.name}`}>
                    <Link to={`/diem-danh?classId=${c.id}`}>
                      <ClipboardCheck className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
