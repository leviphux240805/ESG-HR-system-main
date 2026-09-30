import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Baby, ChevronRight, ClipboardList, Inbox, ListTodo, type LucideIcon, UserMinus, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { errorMessage } from "@/api/errors";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assignSubstitute, MARK_LABELS, type TodaySummary, useToday } from "@/features/school/api";

function Stat({ icon: Icon, label, value, hint, to, tone }: { icon: LucideIcon; label: string; value: string; hint?: string; to?: string; tone?: "warn" }) {
  const body = (
    <Card className={cn("h-full transition-colors", to && "hover:border-primary", tone === "warn" && "border-amber-300 bg-amber-50")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={cn("w-4 h-4", tone === "warn" ? "text-amber-600" : "text-primary")} />
          {label}
        </div>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

type Short = { classId: string; className: string; absentStaffId: string; absentName: string };

function SubstituteDialog({ target, data, onClose }: { target: Short | null; data: TodaySummary; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!target || !staffId) return;
    setBusy(true);
    try {
      await assignSubstitute({ classId: target.classId, absentStaffId: target.absentStaffId, staffId });
      await queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success("Đã phân công người thay.");
      setStaffId("");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phân công người thay</DialogTitle>
          <DialogDescription>
            Lớp {target?.className} hôm nay, thay {target?.absentName}.
          </DialogDescription>
        </DialogHeader>
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger className="min-h-11" aria-label="Người thay">
            <SelectValue placeholder="Chọn người thay" />
          </SelectTrigger>
          <SelectContent>
            {data.availableStaff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName} · {s.position}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button className="min-h-11" onClick={submit} disabled={!staffId || busy}>
            Phân công
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trang mặc định của ban giám hiệu: tình hình trường trong ngày, dùng tốt trên điện thoại. */
export default function TodayPage() {
  const { school } = useCurrentSchool();
  const query = useToday();
  const [target, setTarget] = useState<Short | null>(null);

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data!;

  const enrolled = data.classes.reduce((s, c) => s + c.enrolled, 0);
  const present = data.classes.reduce((s, c) => s + c.present, 0);
  const taken = data.classes.filter((c) => c.taken);
  const takenEnrolled = taken.reduce((s, c) => s + c.enrolled, 0);
  const rate = takenEnrolled ? Math.round((present / takenEnrolled) * 100) : 0;
  const shorts: Short[] = data.classes.flatMap((c) =>
    c.teachers.filter((t) => t.onLeave && !t.substituteName).map((t) => ({ classId: c.id, className: c.name, absentStaffId: t.id, absentName: t.fullName })),
  );
  const notTaken = data.classes.filter((c) => !c.taken);
  const pending = data.pending.leaves + data.pending.tasks;

  return (
    <div className="space-y-5">
      <PageHeader title="Hôm nay" description={`${formatLongDate(data.date)} · ${school?.name ?? ""}`} />

      {!data.isSchoolDay && (
        <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
          Hôm nay trẻ nghỉ học. Số liệu sĩ số lấy theo ngày học gần nhất ({formatDate(data.schoolDay)}).
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Baby} label="Có mặt" value={`${present}/${enrolled}`} hint={taken.length ? `${rate}% · ${taken.length}/${data.classes.length} lớp đã điểm danh` : "Chưa lớp nào điểm danh"} />
        <Stat icon={UserMinus} label="Trẻ vắng" value={String(data.absentChildren.length)} hint={`${data.absentChildren.filter((c) => c.mark === "A").length} không phép`} />
        <Stat icon={UserRoundCheck} label="Nhân viên nghỉ" value={String(data.staffOnLeave.length)} hint={shorts.length ? `${shorts.length} lớp thiếu người` : "Đủ người đứng lớp"} tone={shorts.length ? "warn" : undefined} />
        <Stat icon={Inbox} label="Chờ duyệt" value={String(pending)} hint={`${data.pending.leaves} đơn nghỉ · ${data.pending.tasks} việc`} to="/hop-duyet" tone={pending ? "warn" : undefined} />
      </div>

      {(shorts.length > 0 || notTaken.length > 0) && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Cần xử lý
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shorts.map((s) => (
              <div key={`${s.classId}-${s.absentStaffId}`} className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Lớp {s.className} thiếu người</p>
                  <p className="text-sm text-muted-foreground">{s.absentName} nghỉ, chưa có người thay</p>
                </div>
                <Button className="min-h-11" onClick={() => setTarget(s)}>
                  Phân công người thay
                </Button>
              </div>
            ))}
            {notTaken.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-lg bg-muted p-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1">
                  <span className="font-medium">Lớp {c.name}</span> <span className="text-sm text-muted-foreground">chưa điểm danh</span>
                </p>
                <Button asChild variant="outline" className="min-h-11">
                  <Link to={`/diem-danh?classId=${c.id}`}>Điểm danh</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="classes-heading" className="space-y-2">
        <h2 id="classes-heading" className="font-semibold">
          Sĩ số theo lớp
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.classes.map((c) => (
            <Card key={c.id} className={cn(c.shortStaffed && "border-amber-300")}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{c.name}</p>
                  {c.taken ? (
                    <span className="text-lg font-bold">
                      {c.present}
                      <span className="text-sm font-normal text-muted-foreground">/{c.enrolled}</span>
                    </span>
                  ) : (
                    <Badge variant="outline">Chưa điểm danh</Badge>
                  )}
                </div>
                <Progress value={c.taken && c.enrolled ? (c.present / c.enrolled) * 100 : 0} className="h-2" aria-label={`Tỷ lệ có mặt lớp ${c.name}`} />
                {c.taken && (
                  <p className="text-xs text-muted-foreground">
                    Vắng có phép {c.excused} · không phép {c.absent}
                  </p>
                )}
                <ul className="space-y-0.5 text-sm">
                  {c.teachers.map((t) => (
                    <li key={t.id} className={cn(t.onLeave && "text-muted-foreground")}>
                      {t.onLeave ? <s>{t.fullName}</s> : t.fullName}
                      {t.onLeave && (t.substituteName ? <span className="text-green-700"> → {t.substituteName}</span> : <span className="text-amber-700"> (nghỉ)</span>)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trẻ vắng ({data.absentChildren.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.absentChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có trẻ vắng.</p>
            ) : (
              <ul className="divide-y">
                {data.absentChildren.map((c) => (
                  <li key={c.id}>
                    <Link to={`/tre/${c.id}`} className="flex min-h-11 items-center justify-between gap-2 py-2 hover:text-primary">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.fullName}</span>
                        <span className="text-xs text-muted-foreground">{c.className}</span>
                      </span>
                      <Badge variant={c.mark === "A" ? "destructive" : "secondary"} className="shrink-0">
                        {MARK_LABELS[c.mark]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nhân viên nghỉ ({data.staffOnLeave.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.staffOnLeave.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hôm nay không ai nghỉ.</p>
            ) : (
              <ul className="divide-y">
                {data.staffOnLeave.map((s) => (
                  <li key={s.staffId} className="py-2">
                    <p className="font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.position} · {s.leaveCode}
                      {s.className && ` · ${s.className}`}
                    </p>
                    {s.className && (
                      <p className={cn("text-xs", s.substituteName ? "text-green-700" : "text-amber-700")}>
                        {s.substituteName ? `Người thay: ${s.substituteName}` : "Chưa có người thay"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Công việc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Đến hạn hôm nay", value: data.tasksDueToday, icon: ClipboardList },
              { label: "Quá hạn", value: data.tasksOverdue, icon: AlertTriangle, danger: data.tasksOverdue > 0 },
              { label: "Chờ duyệt hoàn thành", value: data.pending.tasks, icon: ListTodo },
            ].map((row) => (
              <Link key={row.label} to="/cong-viec" className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-muted">
                <row.icon className={cn("w-4 h-4", row.danger ? "text-destructive" : "text-primary")} />
                <span className="flex-1 text-sm">{row.label}</span>
                <span className={cn("font-semibold", row.danger && "text-destructive")}>{row.value}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.classes.length === 0 && <EmptyState title="Cơ sở chưa có lớp" />}
      <SubstituteDialog target={target} data={data} onClose={() => setTarget(null)} />
    </div>
  );
}
