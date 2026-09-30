import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Ruler } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { errorMessage } from "@/api/errors";
import { formatDate } from "@/lib/format";
import { useClasses } from "@/features/school/api";
import { addMeasurement, type GrowthRow, isNormal, useGrowth } from "@/features/health/api";

const todayIso = () => new Date().toLocaleDateString("sv-SE");

function MeasureDialog({ row, onClose }: { row: GrowthRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const num = (v: string) => Number(v.replace(",", "."));

  const save = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await addMeasurement({ childId: row.childId, date, heightCm: num(height), weightKg: num(weight) });
      await Promise.all(["growth", "children"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      toast.success(`Đã lưu số đo của ${row.fullName}.`);
      setHeight("");
      setWeight("");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhập số đo</DialogTitle>
          <DialogDescription>
            {row?.fullName}
            {row?.latest && ` · lần trước ${row.latest.heightCm} cm, ${row.latest.weightKg} kg (${formatDate(row.latest.date)})`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="g-height">Chiều cao (cm)</Label>
            <Input id="g-height" className="min-h-11" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="g-weight">Cân nặng (kg)</Label>
            <Input id="g-weight" className="min-h-11" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="g-date">Ngày cân đo</Label>
            <Input id="g-date" type="date" className="min-h-11" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button className="min-h-11" onClick={save} disabled={busy || !num(height) || !num(weight)}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Cân đo theo lớp: số đo gần nhất, đánh giá dinh dưỡng, nhập số đo mới. */
export default function GrowthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const classes = useClasses();
  const classId = searchParams.get("classId") ?? classes.data?.[0]?.id;
  const query = useGrowth(classId);
  const [target, setTarget] = useState<GrowthRow | null>(null);
  const rows = query.data ?? [];
  const watch = rows.filter((r) => r.status.length && !isNormal(r.status)).length;

  return (
    <div>
      <PageHeader title="Cân đo" description="Chiều cao, cân nặng và đánh giá theo chuẩn tăng trưởng WHO (tham chiếu xấp xỉ)." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={classId ?? ""} onValueChange={(v) => setSearchParams({ classId: v }, { replace: true })}>
          <SelectTrigger className="min-h-11 w-full sm:w-72" aria-label="Chọn lớp">
            <SelectValue placeholder="Chọn lớp" />
          </SelectTrigger>
          <SelectContent>
            {(classes.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rows.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {rows.length} trẻ · <span className={watch ? "font-medium text-destructive" : ""}>{watch} trẻ cần theo dõi</span>
          </p>
        )}
      </div>
      {classes.isLoading || query.isLoading ? (
        <TableSkeleton rows={8} columns={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Ruler} title="Lớp chưa có trẻ" />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.childId}>
              <Card>
                <CardContent className="flex items-center gap-3 p-3">
                  <Link to={`/can-do/${r.childId}`} className="min-w-0 flex-1 rounded-md hover:text-primary">
                    <p className="truncate font-medium">{r.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.ageMonths} tháng
                      {r.latest ? ` · ${r.latest.heightCm} cm · ${r.latest.weightKg} kg · ${formatDate(r.latest.date)}` : " · chưa có số đo"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.status.map((s) => (
                        <Badge key={s} variant={s === "Bình thường" ? "secondary" : "destructive"}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                  <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setTarget(r)}>
                    Nhập số đo
                  </Button>
                  <ChevronRight className="hidden w-4 h-4 text-muted-foreground sm:block" />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <MeasureDialog row={target} onClose={() => setTarget(null)} />
    </div>
  );
}
